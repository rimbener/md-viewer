#import "AppDelegate.h"

#import "ScrollPass.h"
#import "TextSelect.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTEventEmitter.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>

static NSString *const kFocusFind = @"MdViewerFocusFind";

@interface FindFocus : RCTEventEmitter
@end

@implementation FindFocus

RCT_EXPORT_MODULE();

- (NSArray<NSString *> *)supportedEvents
{
  return @[ @"focusFind" ];
}

- (void)startObserving
{
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(onFocusFind)
                                               name:kFocusFind
                                             object:nil];
}

- (void)stopObserving
{
  [[NSNotificationCenter defaultCenter] removeObserver:self name:kFocusFind object:nil];
}

- (void)onFocusFind
{
  [self sendEventWithName:@"focusFind" body:nil];
}

@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification
{
  MdViewerInstallScrollPass();
  MdViewerInstallTextSelect();
  self.moduleName = @"MdViewer";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};
  self.dependencyProvider = [RCTAppDependencyProvider new];
  
  return [super applicationDidFinishLaunching:notification];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

// The Find menu item would open the system panel on the text view.
- (IBAction)focusFind:(__unused id)sender
{
  [[NSNotificationCenter defaultCenter] postNotificationName:kFocusFind object:nil];
}

/// This method controls whether the `concurrentRoot`feature of React18 is turned on or off.
///
/// @see: https://reactjs.org/blog/2022/03/29/react-v18.html
/// @note: This requires to be rendering on Fabric (i.e. on the New Architecture).
/// @return: `true` if the `concurrentRoot` feature is enabled. Otherwise, it returns `false`.
- (BOOL)concurrentRootEnabled
{
#ifdef RN_FABRIC_ENABLED
  return true;
#else
  return false;
#endif
}

@end
