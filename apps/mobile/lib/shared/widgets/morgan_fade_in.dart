import 'package:flutter/material.dart';

import '../../core/theme/morgan_tokens.dart';

class MorganFadeIn extends StatefulWidget {
  const MorganFadeIn({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.offsetY = 12,
  });

  final Widget child;
  final Duration delay;
  final double offsetY;

  @override
  State<MorganFadeIn> createState() => _MorganFadeInState();
}

class _MorganFadeInState extends State<MorganFadeIn> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: MorganDuration.normal);
    _opacity = CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic);
    _slide = Tween<Offset>(begin: Offset(0, widget.offsetY / 100), end: Offset.zero)
        .animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));
    Future<void>.delayed(widget.delay, () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacity,
      child: SlideTransition(position: _slide, child: widget.child),
    );
  }
}
