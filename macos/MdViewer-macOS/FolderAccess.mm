/**
 * The folder grant, written down.
 *
 * A sandboxed build reaches a folder through the open panel, and that grant
 * dies with the process. A security-scoped bookmark is the grant made
 * durable: it is created while the panel's grant is live and resolved on a
 * later launch. Access must be started before the folder is read, and is held
 * until another folder is opened or the app quits.
 *
 * Every method degrades to null rather than failing, so an unsandboxed build —
 * which needs none of this — behaves as if the module were not here.
 */

#import <Cocoa/Cocoa.h>

#import <React/RCTBridgeModule.h>
#import <React/RCTInvalidating.h>

@interface FolderAccess : NSObject <RCTBridgeModule, RCTInvalidating>
@end

@implementation FolderAccess {
  NSURL *_openFolder;
}

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
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

- (void)invalidate
{
  [self stopAccess];
}

- (void)stopAccess
{
  [_openFolder stopAccessingSecurityScopedResource];
  _openFolder = nil;
}

@end
