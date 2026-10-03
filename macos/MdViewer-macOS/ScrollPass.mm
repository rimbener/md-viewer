#import "ScrollPass.h"

#import <objc/runtime.h>

#import <Cocoa/Cocoa.h>

// The new architecture scroll view is RCTEnhancedScrollView. The old one never receives the wheel.
static void (*OriginalScrollWheel)(id, SEL, NSEvent *);
static const void *kAxisLatch = &kAxisLatch;

static BOOL canScroll(NSScrollView *scrollView, BOOL horizontal)
{
  NSView *document = scrollView.documentView;
  if (document == nil) {
    return NO;
  }
  NSSize documentSize = document.frame.size;
  NSSize visibleSize = scrollView.contentView.bounds.size;
  CGFloat overflow = horizontal ? documentSize.width - visibleSize.width : documentSize.height - visibleSize.height;
  return overflow > 1.0;
}

static CGFloat axisDelta(NSEvent *event, BOOL horizontal)
{
  CGFloat value = horizontal ? event.scrollingDeltaX : event.scrollingDeltaY;
  if (value == 0.0) {
    value = horizontal ? event.deltaX : event.deltaY;
  }
  return value;
}

static BOOL gestureStarts(NSEvent *event)
{
  return event.phase == NSEventPhaseBegan ||
      (event.phase == NSEventPhaseNone && event.momentumPhase == NSEventPhaseNone);
}

static BOOL gestureEnds(NSEvent *event)
{
  if (event.momentumPhase == NSEventPhaseEnded || event.momentumPhase == NSEventPhaseCancelled) {
    return YES;
  }
  return (event.phase == NSEventPhaseEnded || event.phase == NSEventPhaseCancelled) &&
      event.momentumPhase == NSEventPhaseNone;
}

static BOOL horizontalGesture(NSScrollView *scrollView, NSEvent *event)
{
  NSNumber *latched = objc_getAssociatedObject(scrollView, kAxisLatch);
  CGFloat dx = fabs(axisDelta(event, YES));
  CGFloat dy = fabs(axisDelta(event, NO));
  BOOL hasDelta = dx > 0.0 || dy > 0.0;
  BOOL horizontal;
  if (hasDelta && (latched == nil || gestureStarts(event))) {
    horizontal = dx > dy;
    objc_setAssociatedObject(scrollView, kAxisLatch, @(horizontal), OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  } else if (latched != nil) {
    horizontal = latched.boolValue;
  } else {
    horizontal = NO;
  }
  if (gestureEnds(event)) {
    objc_setAssociatedObject(scrollView, kAxisLatch, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }
  return horizontal;
}

static NSScrollView *verticalAncestor(NSScrollView *start)
{
  NSView *view = start.superview;
  while (view != nil) {
    if ([view isKindOfClass:[NSScrollView class]] && canScroll((NSScrollView *)view, NO)) {
      return (NSScrollView *)view;
    }
    view = view.superview;
  }
  return nil;
}

static CGFloat verticalPoints(NSEvent *event, NSScrollView *scrollView)
{
  CGFloat dy = event.scrollingDeltaY;
  if (!event.hasPreciseScrollingDeltas) {
    CGFloat lines = dy != 0.0 ? dy : event.deltaY;
    return lines * scrollView.verticalLineScroll;
  }
  if (dy == 0.0) {
    return event.deltaY * scrollView.verticalLineScroll;
  }
  return dy;
}

static void scrollVertically(NSScrollView *scrollView, CGFloat dy)
{
  NSClipView *clip = scrollView.contentView;
  NSView *document = scrollView.documentView;
  if (dy == 0.0 || clip == nil || document == nil) {
    return;
  }
  BOOL flipped = clip.isFlipped || document.isFlipped;
  NSPoint origin = clip.bounds.origin;
  origin.y += flipped ? -dy : dy;

  NSEdgeInsets inset = scrollView.contentInsets;
  CGFloat minY = -inset.top;
  CGFloat maxY = MAX(minY, NSHeight(document.frame) - NSHeight(clip.bounds) + inset.bottom);
  origin.y = MIN(MAX(origin.y, minY), maxY);
  [clip scrollToPoint:origin];
  [scrollView reflectScrolledClipView:clip];
}

static void passScrollWheel(NSScrollView *self, SEL cmd, NSEvent *event)
{
  if (self.hasVerticalScroller && canScroll(self, NO)) {
    OriginalScrollWheel(self, cmd, event);
    return;
  }
  if (horizontalGesture(self, event) && canScroll(self, YES)) {
    OriginalScrollWheel(self, cmd, event);
    return;
  }
  NSScrollView *ancestor = verticalAncestor(self);
  if (ancestor == nil) {
    OriginalScrollWheel(self, cmd, event);
    return;
  }
  scrollVertically(ancestor, verticalPoints(event, ancestor));
}

static void installOnClass(Class cls)
{
  if (cls == Nil) {
    return;
  }
  SEL sel = @selector(scrollWheel:);
  Method method = class_getInstanceMethod(cls, sel);
  if (method == NULL) {
    return;
  }
  IMP current = method_getImplementation(method);
  if (current == (IMP)passScrollWheel) {
    return;
  }
  if (OriginalScrollWheel == NULL) {
    OriginalScrollWheel = (void (*)(id, SEL, NSEvent *))current;
  }
  if (!class_addMethod(cls, sel, (IMP)passScrollWheel, method_getTypeEncoding(method))) {
    method_setImplementation(class_getInstanceMethod(cls, sel), (IMP)passScrollWheel);
  }
}

void MdViewerInstallScrollPass(void)
{
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    installOnClass(NSClassFromString(@"RCTEnhancedScrollView"));
    installOnClass(NSClassFromString(@"RCTCustomScrollView"));
  });
}
