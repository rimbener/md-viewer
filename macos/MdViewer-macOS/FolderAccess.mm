/**
 * The folder grant: where it comes from, and how it is written down.
 *
 * A sandboxed build reaches a folder through the open panel, and that grant
 * dies with the process. A security-scoped bookmark is the grant made
 * durable: it is created while the panel's grant is live and resolved on a
 * later launch. Access must be started before the folder is read, and is held
 * until another folder is opened or the app quits.
 *
 * The same grant is what lets a vnode source watch the open file.
 *
 * Every method degrades to null rather than failing, so an unsandboxed build —
 * which needs none of this — behaves as if the module were not here.
 */

#import <fcntl.h>
#import <sys/event.h>

#import <Cocoa/Cocoa.h>

#import <React/RCTEventEmitter.h>

static const void *kWatchQueueKey = &kWatchQueueKey;

@interface FolderAccess : RCTEventEmitter
@end

@implementation FolderAccess {
  NSURL *_openFolder;
  NSString *_watchedPath;
  dispatch_source_t _vnode;
  dispatch_queue_t _watchQueue;
}

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  if (self = [super init]) {
    _watchQueue = dispatch_queue_create("mdviewer.filewatch", DISPATCH_QUEUE_SERIAL);
    dispatch_queue_set_specific(_watchQueue, kWatchQueueKey, (void *)1, NULL);
  }
  return self;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ @"fileChanged" ];
}

- (void)onWatchQueue:(void (^)(void))block
{
  if (dispatch_get_specific(kWatchQueueKey) != NULL) {
    block();
  } else {
    dispatch_sync(_watchQueue, block);
  }
}

- (void)disarm
{
  if (_vnode == nil) {
    return;
  }
  dispatch_source_cancel(_vnode);
  _vnode = nil;
}

- (void)arm
{
  if (_watchedPath == nil) {
    return;
  }
  const char *cpath = _watchedPath.fileSystemRepresentation;
  if (cpath == NULL) {
    return;
  }
  int fd = open(cpath, O_EVTONLY);
  if (fd < 0) {
    return;
  }
  dispatch_source_t source = dispatch_source_create(
      DISPATCH_SOURCE_TYPE_VNODE,
      (uintptr_t)fd,
      NOTE_WRITE | NOTE_EXTEND | NOTE_ATTRIB | NOTE_RENAME | NOTE_DELETE,
      _watchQueue);
  if (source == nil) {
    close(fd);
    return;
  }
  __weak FolderAccess *weakSelf = self;
  dispatch_source_set_event_handler(source, ^{
    FolderAccess *strongSelf = weakSelf;
    if (strongSelf == nil) {
      return;
    }
    unsigned long flags = dispatch_source_get_data(source);
    NSString *path = strongSelf->_watchedPath;
    if (path != nil) {
      dispatch_async(dispatch_get_main_queue(), ^{
        [strongSelf sendEventWithName:@"fileChanged" body:@{@"path" : path}];
      });
    }
    // Editors save by rename/replace, so NOTE_DELETE/NOTE_RENAME leaves a dead fd.
    if ((flags & (NOTE_DELETE | NOTE_RENAME)) != 0) {
      [strongSelf disarm];
      [strongSelf arm];
    }
  });
  dispatch_source_set_cancel_handler(source, ^{
    close(fd);
  });
  _vnode = source;
  dispatch_resume(source);
}

RCT_EXPORT_METHOD(choose:(RCTPromiseResolveBlock)resolve
                  reject:(__unused RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSOpenPanel *panel = [NSOpenPanel openPanel];

    panel.canChooseDirectories = YES;
    panel.canChooseFiles = NO;
    panel.allowsMultipleSelection = NO;
    panel.resolvesAliases = YES;
    // The scan walks hidden directories — `.claude`, `.github`, `.cursor` hold
    // a lot of specs — so the panel has to let one be picked as the root.
    panel.showsHiddenFiles = YES;

    NSURL *url =
        [panel runModal] == NSModalResponseOK ? panel.URLs.firstObject : nil;
    resolve(url == nil ? nil : url.path);
  });
}

RCT_EXPORT_METHOD(bookmark:(NSString *)path
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(__unused RCTPromiseRejectBlock)reject)
{
  NSURL *url = [NSURL fileURLWithPath:path isDirectory:YES];
  NSData *data =
      [url bookmarkDataWithOptions:NSURLBookmarkCreationWithSecurityScope
    includingResourceValuesForKeys:nil
                     relativeToURL:nil
                             error:nil];
  resolve(data == nil ? nil : [data base64EncodedStringWithOptions:0]);
}

RCT_EXPORT_METHOD(open:(NSString *)bookmark
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(__unused RCTPromiseRejectBlock)reject)
{
  NSData *data = [[NSData alloc] initWithBase64EncodedString:bookmark options:0];
  if (data == nil) {
    resolve(nil);
    return;
  }

  BOOL isStale = NO;
  NSURL *url =
      [NSURL URLByResolvingBookmarkData:data
                                options:NSURLBookmarkResolutionWithSecurityScope
                          relativeToURL:nil
                    bookmarkDataIsStale:&isStale
                                  error:nil];
  if (url == nil || ![url startAccessingSecurityScopedResource]) {
    resolve(nil);
    return;
  }

  [self stopAccess];
  _openFolder = url;
  resolve(@{@"path" : url.path, @"isStale" : @(isStale)});
}

RCT_EXPORT_METHOD(close)
{
  [self stopAccess];
}

RCT_EXPORT_METHOD(watch:(NSString *)path)
{
  if (path.length == 0) {
    return;
  }
  [self onWatchQueue:^{
    [self disarm];
    self->_watchedPath = [path copy];
    [self arm];
  }];
}

RCT_EXPORT_METHOD(unwatch)
{
  [self onWatchQueue:^{
    [self disarm];
    self->_watchedPath = nil;
  }];
}

- (void)invalidate
{
  [self stopAccess];
  [super invalidate];
}

- (void)stopAccess
{
  [self onWatchQueue:^{
    [self disarm];
    self->_watchedPath = nil;
  }];
  [_openFolder stopAccessingSecurityScopedResource];
  _openFolder = nil;
}

@end
