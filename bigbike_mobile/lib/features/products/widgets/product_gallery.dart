import 'package:flutter/material.dart';
import 'package:carousel_slider/carousel_slider.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import '../../../core/widgets/media_image.dart';
import '../../../core/theme/app_colors.dart';

class ProductGallery extends StatefulWidget {
  final List<String> images;
  const ProductGallery({super.key, required this.images});

  @override
  State<ProductGallery> createState() => _ProductGalleryState();
}

class _ProductGalleryState extends State<ProductGallery> {
  int _current = 0;
  final _controller = CarouselSliderController();

  @override
  Widget build(BuildContext context) {
    final all = widget.images.isEmpty ? <String>[] : widget.images;
    if (all.isEmpty) {
      return MediaImage(
          src: null, height: 300, width: double.infinity);
    }

    return Column(
      children: [
        CarouselSlider.builder(
          carouselController: _controller,
          itemCount: all.length,
          options: CarouselOptions(
            height: 300,
            viewportFraction: 1.0,
            enableInfiniteScroll: all.length > 1,
            onPageChanged: (i, _) => setState(() => _current = i),
          ),
          itemBuilder: (_, i, __) => MediaImage(
            src: all[i],
            width: double.infinity,
            height: 300,
            fit: BoxFit.contain,
          ),
        ),
        if (all.length > 1) ...[
          const SizedBox(height: 8),
          AnimatedSmoothIndicator(
            activeIndex: _current,
            count: all.length,
            effect: const ExpandingDotsEffect(
              dotHeight: 5,
              dotWidth: 5,
              activeDotColor: AppColors.primary,
              dotColor: AppColors.borderDefault,
            ),
            onDotClicked: (i) => _controller.animateToPage(i),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 56,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: all.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) => GestureDetector(
                onTap: () => _controller.animateToPage(i),
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: _current == i
                          ? AppColors.primary
                          : AppColors.borderSubtle,
                      width: _current == i ? 2 : 1,
                    ),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(5),
                    child: MediaImage(
                        src: all[i], width: 48, height: 48,
                        fit: BoxFit.cover),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
