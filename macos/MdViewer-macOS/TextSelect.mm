#import "TextSelect.h"

#import <objc/runtime.h>

#import <Cocoa/Cocoa.h>

// Take focus before the tracking loop. A text view will not resign during it,
// and the stock hit test misses after a scroll, so the drag never starts.
static void (*OriginalMouseDown)(id, SEL, NSEvent *);

static id ivar(id object, const char *name)
{
  Ivar slot = class_getInstanceVariable([object class], name);
  if (slot == NULL) {
    return nil;
  }
  return object_getIvar(object, slot);
}

// A code fence is its own horizontal scroll view. NSTextView mouseDown scrolls
// that view and the selection never starts.
static BOOL codeFence(NSTextView *textView)
{
  NSScrollView *scrollView = textView.enclosingScrollView;
  if (scrollView == nil) {
    return NO;
  }
  if (!scrollView.hasVerticalScroller) {
    return YES;
  }
  NSView *document = scrollView.documentView;
  BOOL fits = document != nil &&
      NSHeight(document.frame) - NSHeight(scrollView.contentView.bounds) <= 1.0;
  if (!fits) {
    return NO;
  }
  NSView *view = scrollView.superview;
  while (view != nil) {
    if ([view isKindOfClass:[NSScrollView class]] && ((NSScrollView *)view).hasVerticalScroller) {
      return YES;
    }
    view = view.superview;
  }
  return NO;
}

static NSUInteger insertionIndex(NSTextView *textView, NSEvent *event)
{
  NSPoint point = [textView convertPoint:event.locationInWindow fromView:nil];
  NSUInteger index = [textView characterIndexForInsertionAtPoint:point];
  NSUInteger length = textView.string.length;
  return index > length ? length : index;
}

static NSRange rangeForClick(NSTextView *textView, NSEvent *event, NSUInteger index)
{
  NSSelectionGranularity granularity = NSSelectByCharacter;
  if (event.clickCount == 2) {
    granularity = NSSelectByWord;
  } else if (event.clickCount >= 3) {
    granularity = NSSelectByParagraph;
  }
  if (granularity == NSSelectByCharacter) {
    return NSMakeRange(index, 0);
  }
  return [textView selectionRangeForProposedRange:NSMakeRange(index, 0) granularity:granularity];
}

static void trackSelection(NSTextView *textView, NSEvent *event)
{
  NSWindow *window = textView.window;
  if (window == nil) {
    return;
  }
  NSRange base = rangeForClick(textView, event, insertionIndex(textView, event));
  textView.selectedRange = base;

  while (YES) {
    NSEvent *next = [window nextEventMatchingMask:NSEventMaskLeftMouseDragged | NSEventMaskLeftMouseUp
                                        untilDate:[NSDate distantFuture]
                                           inMode:NSEventTrackingRunLoopMode
                                          dequeue:YES];
    if (next == nil || next.type == NSEventTypeLeftMouseUp) {
      break;
    }
    NSUInteger index = insertionIndex(textView, next);
    NSUInteger start = MIN(base.location, index);
    NSUInteger end = MAX(NSMaxRange(base), index);
    textView.selectedRange = NSMakeRange(start, end - start);
  }
}

static void cancelTouches(NSView *view)
{
  Class cls = NSClassFromString(@"RCTSurfaceTouchHandler");
  while (view != nil) {
    for (id gesture in view.gestureRecognizers) {
      if (cls != Nil && [gesture isKindOfClass:cls]) {
        [gesture setEnabled:NO];
        [gesture setEnabled:YES];
        return;
      }
    }
    view = view.superview;
  }
}

static void mouseDown(id self, SEL cmd, NSEvent *event)
{
  NSTextView *textView = ivar(self, "_selectableTextView");
  NSView *view = self;
  if (textView == nil || view.window == nil) {
    OriginalMouseDown(self, cmd, event);
    return;
  }

  [view.window makeFirstResponder:textView];

  BOOL startsSelection = event.clickCount > 1;
  if (!startsSelection) {
    NSEvent *next = [view.window nextEventMatchingMask:NSEventMaskLeftMouseUp | NSEventMaskLeftMouseDragged
                                             untilDate:[NSDate distantFuture]
                                                inMode:NSEventTrackingRunLoopMode
                                               dequeue:NO];
    startsSelection = next != nil && next.type == NSEventTypeLeftMouseDragged;
  }

  if (!startsSelection) {
    textView.selectedRange = NSMakeRange(NSNotFound, 0);
    return;
  }

  cancelTouches(view);
  [view.window makeFirstResponder:textView];
  if (codeFence(textView)) {
    trackSelection(textView, event);
    return;
  }
  [textView mouseDown:event];
}

void MdViewerInstallTextSelect(void)
{
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    Class cls = NSClassFromString(@"RCTParagraphComponentView");
    Method method = cls == Nil ? NULL : class_getInstanceMethod(cls, @selector(mouseDown:));
    if (method == NULL) {
      return;
    }
    OriginalMouseDown = (void (*)(id, SEL, NSEvent *))method_getImplementation(method);
    method_setImplementation(method, (IMP)mouseDown);
  });
}
