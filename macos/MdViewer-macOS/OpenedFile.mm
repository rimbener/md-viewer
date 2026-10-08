#import "OpenedFile.h"

#import <Cocoa/Cocoa.h>

#import <React/RCTEventEmitter.h>

static NSString *const kOpenedFile = @"openedFile";

static NSURL *scopedURL;
static BOOL scopedStarted;
static NSString *pendingPath;
static BOOL listening;
static __weak RCTEventEmitter *emitter;

static BOOL isClaimedMarkdown(NSURL *url)
{
  if (!url.isFileURL) {
    return NO;
  }
  NSString *ext = url.pathExtension.lowercaseString;
  return [ext isEqualToString:@"md"] || [ext isEqualToString:@"markdown"] ||
      [ext isEqualToString:@"mdc"];
}

static void publish(NSString *path)
{
  if (listening && emitter != nil) {
    pendingPath = nil;
    [emitter sendEventWithName:kOpenedFile body:@{@"path" : path}];
    return;
  }
  pendingPath = path;
}

static void releaseScope(void)
{
  if (scopedStarted) {
    [scopedURL stopAccessingSecurityScopedResource];
  }
  scopedURL = nil;
  scopedStarted = NO;
}

BOOL MdViewerAcceptOpenedURL(NSURL *url)
{
  if (!isClaimedMarkdown(url)) {
    return NO;
  }
  NSString *path = url.path;
  if (path.length == 0) {
    return NO;
  }
  if ([scopedURL.path isEqualToString:path]) {
    publish(path);
    return YES;
  }
  // The Finder grant ends when application:openURLs: returns.
  BOOL started = [url startAccessingSecurityScopedResource];
  releaseScope();
  scopedURL = url;
  scopedStarted = started;
  publish(path);
  return YES;
}

@interface OpenedFile : RCTEventEmitter
@end

@implementation OpenedFile

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

- (instancetype)init
{
  if (self = [super init]) {
    emitter = self;
  }
  return self;
}

- (void)invalidate
{
  if (emitter == self) {
    emitter = nil;
    listening = NO;
  }
  [super invalidate];
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ kOpenedFile ];
}

- (void)startObserving
{
  listening = YES;
}

- (void)stopObserving
{
  listening = NO;
}

RCT_EXPORT_METHOD(take:(RCTPromiseResolveBlock)resolve
                  reject:(__unused RCTPromiseRejectBlock)reject)
{
  NSString *path = pendingPath;
  pendingPath = nil;
  resolve(path == nil ? [NSNull null] : path);
}

@end
