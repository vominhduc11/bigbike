class MenuItem {
  final String id;
  final String label;
  final String? url;
  final List<MenuItem> children;

  const MenuItem({
    required this.id,
    required this.label,
    this.url,
    required this.children,
  });

  factory MenuItem.fromJson(Map<String, dynamic> j) => MenuItem(
        id: j['id'].toString(),
        label: j['label'] as String? ?? '',
        url: j['url'] as String?,
        children: (j['children'] as List? ?? [])
            .cast<Map<String, dynamic>>()
            .map(MenuItem.fromJson)
            .toList(),
      );
}
