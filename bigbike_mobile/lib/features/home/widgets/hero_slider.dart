import 'package:carousel_slider/carousel_slider.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/models/slider.dart';
import '../../../core/widgets/media_image.dart';
import '../../../core/theme/app_colors.dart';

class HeroSlider extends StatefulWidget {
  final List<AppSlider> sliders;
  const HeroSlider({super.key, required this.sliders});

  @override
  State<HeroSlider> createState() => _HeroSliderState();
}

class _HeroSliderState extends State<HeroSlider> {
  int _current = 0;
  final _controller = CarouselSliderController();

  void _onSlideTap(BuildContext context, String? linkUrl) {
    if (linkUrl == null || linkUrl.isEmpty) return;
    final uri = Uri.tryParse(linkUrl);
    if (uri == null) return;
    if (uri.isAbsolute && (uri.scheme == 'http' || uri.scheme == 'https')) {
      launchUrl(uri, mode: LaunchMode.inAppBrowserView);
    } else {
      context.push(linkUrl);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        CarouselSlider.builder(
          carouselController: _controller,
          itemCount: widget.sliders.length,
          options: CarouselOptions(
            height: 200,
            viewportFraction: 1.0,
            autoPlay: true,
            autoPlayInterval: const Duration(seconds: 4),
            onPageChanged: (i, _) => setState(() => _current = i),
          ),
          itemBuilder: (context, i, _) {
            final slide = widget.sliders[i];
            return GestureDetector(
              onTap: () => _onSlideTap(context, slide.linkUrl),
              child: MediaImage(
                src: slide.image,
                width: double.infinity,
                height: 200,
                fit: BoxFit.cover,
              ),
            );
          },
        ),
        const SizedBox(height: 8),
        AnimatedSmoothIndicator(
          activeIndex: _current,
          count: widget.sliders.length,
          effect: const ExpandingDotsEffect(
            dotHeight: 6,
            dotWidth: 6,
            activeDotColor: AppColors.primary,
            dotColor: AppColors.borderDefault,
          ),
          onDotClicked: (i) => _controller.animateToPage(i),
        ),
      ],
    );
  }
}
