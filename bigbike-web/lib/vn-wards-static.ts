// Ward data keyed by district code (from vn-address-data.ts).
// Districts without data fall back to text input in VnAddressFields.
type W = { code: string; name: string };
function w(code: string, name: string): W { return { code, name }; }

export const VN_WARDS: Record<string, W[]> = {
  // ── HÀ NỘI ─────────────────────────────────────────────────────────────
  "001": [ // Quận Ba Đình
    w("00001","Phường Phúc Xá"),w("00004","Phường Trúc Bạch"),w("00006","Phường Vĩnh Phúc"),
    w("00007","Phường Cống Vị"),w("00008","Phường Liễu Giai"),w("00010","Phường Nguyễn Trung Trực"),
    w("00013","Phường Quan Thánh"),w("00016","Phường Ngọc Hà"),w("00019","Phường Điện Biên"),
    w("00022","Phường Đội Cấn"),w("00025","Phường Ngọc Khánh"),w("00028","Phường Kim Mã"),
    w("00031","Phường Giảng Võ"),w("00034","Phường Thành Công"),
  ],
  "002": [ // Quận Hoàn Kiếm
    w("00037","Phường Phúc Tân"),w("00040","Phường Đồng Xuân"),w("00043","Phường Hàng Mã"),
    w("00046","Phường Hàng Buồm"),w("00049","Phường Hàng Đào"),w("00052","Phường Hàng Bồ"),
    w("00055","Phường Cửa Đông"),w("00058","Phường Lý Thái Tổ"),w("00061","Phường Hàng Bạc"),
    w("00064","Phường Hàng Gai"),w("00067","Phường Chương Dương"),w("00070","Phường Hàng Trống"),
    w("00073","Phường Cửa Nam"),w("00076","Phường Hàng Bông"),w("00079","Phường Tràng Tiền"),
    w("00082","Phường Trần Hưng Đạo"),w("00085","Phường Phan Chu Trinh"),w("00088","Phường Nguyễn Du"),
  ],
  "003": [ // Quận Tây Hồ
    w("00091","Phường Phú Thượng"),w("00094","Phường Nhật Tân"),w("00097","Phường Tứ Liên"),
    w("00100","Phường Quảng An"),w("00103","Phường Xuân La"),w("00106","Phường Yên Phụ"),
    w("00109","Phường Bưởi"),w("00112","Phường Thụy Khuê"),
  ],
  "004": [ // Quận Long Biên
    w("00115","Phường Thượng Thanh"),w("00118","Phường Ngọc Thụy"),w("00121","Phường Giang Biên"),
    w("00124","Phường Đức Giang"),w("00127","Phường Việt Hưng"),w("00130","Phường Gia Thụy"),
    w("00133","Phường Ngọc Lâm"),w("00136","Phường Phúc Lợi"),w("00139","Phường Bồ Đề"),
    w("00142","Phường Sài Đồng"),w("00145","Phường Long Biên"),w("00148","Phường Thạch Bàn"),
    w("00151","Phường Phúc Đồng"),w("00154","Phường Cự Khối"),
  ],
  "005": [ // Quận Cầu Giấy
    w("00157","Phường Nghĩa Đô"),w("00160","Phường Nghĩa Tân"),w("00163","Phường Mai Dịch"),
    w("00166","Phường Dịch Vọng"),w("00169","Phường Dịch Vọng Hậu"),w("00172","Phường Quan Hoa"),
    w("00175","Phường Yên Hòa"),w("00178","Phường Trung Hòa"),
  ],
  "006": [ // Quận Đống Đa
    w("00181","Phường Cát Linh"),w("00184","Phường Văn Miếu"),w("00187","Phường Quốc Tử Giám"),
    w("00190","Phường Láng Thượng"),w("00193","Phường Ô Chợ Dừa"),w("00196","Phường Văn Chương"),
    w("00199","Phường Hàng Bột"),w("00202","Phường Láng Hạ"),w("00205","Phường Khâm Thiên"),
    w("00208","Phường Thổ Quan"),w("00211","Phường Nam Đồng"),w("00214","Phường Trung Phụng"),
    w("00217","Phường Phương Liên"),w("00220","Phường Thịnh Quang"),w("00223","Phường Trung Liệt"),
    w("00226","Phường Phương Mai"),w("00229","Phường Kim Liên"),w("00232","Phường Trung Tự"),
    w("00235","Phường Khương Thượng"),w("00238","Phường Ngã Tư Sở"),w("00241","Phường Xã Đàn"),
  ],
  "007": [ // Quận Hai Bà Trưng
    w("00244","Phường Nguyễn Du"),w("00247","Phường Bạch Đằng"),w("00250","Phường Phạm Đình Hổ"),
    w("00253","Phường Lê Đại Hành"),w("00256","Phường Đồng Nhân"),w("00259","Phường Phố Huế"),
    w("00262","Phường Đống Mác"),w("00265","Phường Thanh Lương"),w("00268","Phường Thanh Nhàn"),
    w("00271","Phường Cầu Dền"),w("00274","Phường Bách Khoa"),w("00277","Phường Đồng Tâm"),
    w("00280","Phường Vĩnh Tuy"),w("00283","Phường Bạch Mai"),w("00286","Phường Quỳnh Lôi"),
    w("00289","Phường Bùi Thị Xuân"),w("00292","Phường Nguyễn Du"),w("00295","Phường Quỳnh Mai"),
    w("00298","Phường Minh Khai"),w("00301","Phường Trương Định"),
  ],
  "008": [ // Quận Hoàng Mai
    w("00304","Phường Thanh Trì"),w("00307","Phường Vĩnh Hưng"),w("00310","Phường Định Công"),
    w("00313","Phường Mai Động"),w("00316","Phường Tương Mai"),w("00319","Phường Đại Kim"),
    w("00322","Phường Tân Mai"),w("00325","Phường Hoàng Văn Thụ"),w("00328","Phường Giáp Bát"),
    w("00331","Phường Lĩnh Nam"),w("00334","Phường Thịnh Liệt"),w("00337","Phường Trần Phú"),
    w("00340","Phường Hoàng Liệt"),w("00343","Phường Yên Sở"),
  ],
  "009": [ // Quận Thanh Xuân
    w("00346","Phường Nhân Chính"),w("00349","Phường Thượng Đình"),w("00352","Phường Khương Trung"),
    w("00355","Phường Khương Mai"),w("00358","Phường Thanh Xuân Trung"),w("00361","Phường Phương Liệt"),
    w("00364","Phường Hạ Đình"),w("00367","Phường Khương Đình"),w("00370","Phường Thanh Xuân Bắc"),
    w("00373","Phường Thanh Xuân Nam"),w("00376","Phường Kim Giang"),
  ],
  "010": [ // Quận Nam Từ Liêm
    w("00379","Phường Cầu Diễn"),w("00382","Phường Xuân Phương"),w("00385","Phường Phương Canh"),
    w("00388","Phường Mỹ Đình 1"),w("00391","Phường Mỹ Đình 2"),w("00394","Phường Tây Mỗ"),
    w("00397","Phường Mễ Trì"),w("00400","Phường Phú Đô"),w("00403","Phường Đại Mỗ"),
    w("00406","Phường Trung Văn"),
  ],
  "011": [ // Quận Bắc Từ Liêm
    w("00409","Phường Thượng Cát"),w("00412","Phường Liên Mạc"),w("00415","Phường Đông Ngạc"),
    w("00418","Phường Đức Thắng"),w("00421","Phường Thụy Phương"),w("00424","Phường Tây Tựu"),
    w("00427","Phường Xuân Đỉnh"),w("00430","Phường Xuân Tảo"),w("00433","Phường Minh Khai"),
    w("00436","Phường Cổ Nhuế 1"),w("00439","Phường Cổ Nhuế 2"),w("00442","Phường Phú Diễn"),
    w("00445","Phường Phúc Diễn"),
  ],
  "012": [ // Quận Hà Đông
    w("00448","Phường Nguyễn Trãi"),w("00451","Phường Mộ Lao"),w("00454","Phường Văn Quán"),
    w("00457","Phường Vạn Phúc"),w("00460","Phường Yên Phúc"),w("00463","Phường Kiến Hưng"),
    w("00466","Phường Phúc La"),w("00469","Phường Hà Cầu"),w("00472","Phường Yên Nghĩa"),
    w("00475","Phường Dương Nội"),w("00478","Phường La Khê"),w("00481","Phường Phú La"),
    w("00484","Phường Phú Lãm"),w("00487","Phường Phú Lương"),w("00490","Phường Biên Giang"),
    w("00493","Phường Đồng Mai"),w("00496","Phường Quang Trung"),
  ],

  // ── TP. HỒ CHÍ MINH ────────────────────────────────────────────────────
  "760": [ // Quận 1
    w("26734","Phường Tân Định"),w("26737","Phường Đa Kao"),w("26740","Phường Bến Nghé"),
    w("26743","Phường Bến Thành"),w("26746","Phường Nguyễn Thái Bình"),w("26749","Phường Phạm Ngũ Lão"),
    w("26752","Phường Cầu Ông Lãnh"),w("26755","Phường Cô Giang"),w("26758","Phường Nguyễn Cư Trinh"),
    w("26761","Phường Cầu Kho"),
  ],
  "761": [ // Quận 3
    w("26764","Phường 1"),w("26767","Phường 2"),w("26770","Phường 3"),w("26773","Phường 4"),
    w("26776","Phường 5"),w("26779","Phường 6"),w("26782","Phường 7"),w("26785","Phường 8"),
    w("26788","Phường 9"),w("26791","Phường 10"),w("26794","Phường 11"),w("26797","Phường 12"),
    w("26800","Phường 13"),w("26803","Phường 14"),
  ],
  "762": [ // Quận 4
    w("26806","Phường 1"),w("26809","Phường 2"),w("26812","Phường 3"),w("26815","Phường 4"),
    w("26818","Phường 6"),w("26821","Phường 8"),w("26824","Phường 9"),w("26827","Phường 10"),
    w("26830","Phường 13"),w("26833","Phường 14"),w("26836","Phường 15"),w("26839","Phường 16"),
    w("26842","Phường 18"),
  ],
  "763": [ // Quận 5
    w("26845","Phường 1"),w("26848","Phường 2"),w("26851","Phường 3"),w("26854","Phường 4"),
    w("26857","Phường 5"),w("26860","Phường 6"),w("26863","Phường 7"),w("26866","Phường 8"),
    w("26869","Phường 9"),w("26872","Phường 10"),w("26875","Phường 11"),w("26878","Phường 12"),
    w("26881","Phường 13"),w("26884","Phường 14"),w("26887","Phường 15"),
  ],
  "764": [ // Quận 6
    w("26890","Phường 1"),w("26893","Phường 2"),w("26896","Phường 3"),w("26899","Phường 4"),
    w("26902","Phường 5"),w("26905","Phường 6"),w("26908","Phường 7"),w("26911","Phường 8"),
    w("26914","Phường 9"),w("26917","Phường 10"),w("26920","Phường 11"),w("26923","Phường 12"),
    w("26926","Phường 13"),w("26929","Phường 14"),
  ],
  "765": [ // Quận 7
    w("26932","Phường Tân Thuận Đông"),w("26935","Phường Tân Thuận Tây"),w("26938","Phường Tân Kiểng"),
    w("26941","Phường Tân Hưng"),w("26944","Phường Bình Thuận"),w("26947","Phường Tân Quy"),
    w("26950","Phường Phú Thuận"),w("26953","Phường Tân Phong"),w("26956","Phường Tân Phú"),
    w("26959","Phường Phú Mỹ"),
  ],
  "766": [ // Quận 8
    w("26962","Phường 1"),w("26965","Phường 2"),w("26968","Phường 3"),w("26971","Phường 4"),
    w("26974","Phường 5"),w("26977","Phường 6"),w("26980","Phường 7"),w("26983","Phường 8"),
    w("26986","Phường 9"),w("26989","Phường 10"),w("26992","Phường 11"),w("26995","Phường 12"),
    w("26998","Phường 13"),w("27001","Phường 14"),w("27004","Phường 15"),w("27007","Phường 16"),
  ],
  "767": [ // Quận 10
    w("27010","Phường 1"),w("27013","Phường 2"),w("27016","Phường 3"),w("27019","Phường 4"),
    w("27022","Phường 5"),w("27025","Phường 6"),w("27028","Phường 7"),w("27031","Phường 8"),
    w("27034","Phường 9"),w("27037","Phường 10"),w("27040","Phường 11"),w("27043","Phường 12"),
    w("27046","Phường 13"),w("27049","Phường 14"),w("27052","Phường 15"),
  ],
  "768": [ // Quận 11
    w("27055","Phường 1"),w("27058","Phường 2"),w("27061","Phường 3"),w("27064","Phường 4"),
    w("27067","Phường 5"),w("27070","Phường 6"),w("27073","Phường 7"),w("27076","Phường 8"),
    w("27079","Phường 9"),w("27082","Phường 10"),w("27085","Phường 11"),w("27088","Phường 12"),
    w("27091","Phường 13"),w("27094","Phường 14"),w("27097","Phường 15"),w("27100","Phường 16"),
  ],
  "769": [ // Quận 12
    w("27103","Phường Thạnh Xuân"),w("27106","Phường Thạnh Lộc"),w("27109","Phường Hiệp Thành"),
    w("27112","Phường Thới An"),w("27115","Phường Tân Chánh Hiệp"),w("27118","Phường An Phú Đông"),
    w("27121","Phường Tân Thới Hiệp"),w("27124","Phường Trung Mỹ Tây"),w("27127","Phường Tân Hưng Thuận"),
    w("27130","Phường Đông Hưng Thuận"),w("27133","Phường Tân Thới Nhất"),
  ],
  "770": [ // Quận Bình Thạnh
    w("27136","Phường 1"),w("27139","Phường 2"),w("27142","Phường 3"),w("27145","Phường 5"),
    w("27148","Phường 6"),w("27151","Phường 7"),w("27154","Phường 11"),w("27157","Phường 12"),
    w("27160","Phường 13"),w("27163","Phường 14"),w("27166","Phường 15"),w("27169","Phường 17"),
    w("27172","Phường 19"),w("27175","Phường 21"),w("27178","Phường 22"),w("27181","Phường 24"),
    w("27184","Phường 25"),w("27187","Phường 26"),w("27190","Phường 27"),w("27193","Phường 28"),
  ],
  "771": [ // Quận Gò Vấp
    w("27196","Phường 1"),w("27199","Phường 3"),w("27202","Phường 4"),w("27205","Phường 5"),
    w("27208","Phường 6"),w("27211","Phường 7"),w("27214","Phường 8"),w("27217","Phường 9"),
    w("27220","Phường 10"),w("27223","Phường 11"),w("27226","Phường 12"),w("27229","Phường 13"),
    w("27232","Phường 14"),w("27235","Phường 15"),w("27238","Phường 16"),w("27241","Phường 17"),
  ],
  "772": [ // Quận Phú Nhuận
    w("27244","Phường 1"),w("27247","Phường 2"),w("27250","Phường 3"),w("27253","Phường 4"),
    w("27256","Phường 5"),w("27259","Phường 7"),w("27262","Phường 8"),w("27265","Phường 9"),
    w("27268","Phường 10"),w("27271","Phường 11"),w("27274","Phường 12"),w("27277","Phường 13"),
    w("27280","Phường 15"),w("27283","Phường 17"),
  ],
  "773": [ // Quận Tân Bình
    w("27286","Phường 1"),w("27289","Phường 2"),w("27292","Phường 3"),w("27295","Phường 4"),
    w("27298","Phường 5"),w("27301","Phường 6"),w("27304","Phường 7"),w("27307","Phường 8"),
    w("27310","Phường 9"),w("27313","Phường 10"),w("27316","Phường 11"),w("27319","Phường 12"),
    w("27322","Phường 13"),w("27325","Phường 14"),w("27328","Phường 15"),
  ],
  "774": [ // Quận Tân Phú
    w("27331","Phường Tân Sơn Nhì"),w("27334","Phường Tây Thạnh"),w("27337","Phường Sơn Kỳ"),
    w("27340","Phường Tân Quý"),w("27343","Phường Tân Thành"),w("27346","Phường Phú Thọ Hòa"),
    w("27349","Phường Phú Thạnh"),w("27352","Phường Phú Trung"),w("27355","Phường Hòa Thạnh"),
    w("27358","Phường Hiệp Tân"),w("27361","Phường Tân Thới Hòa"),
  ],
  "775": [ // TP. Thủ Đức
    w("27364","Phường Linh Xuân"),w("27367","Phường Bình Chiểu"),w("27370","Phường Linh Trung"),
    w("27373","Phường Tam Bình"),w("27376","Phường Tam Phú"),w("27379","Phường Hiệp Bình Phước"),
    w("27382","Phường Hiệp Bình Chánh"),w("27385","Phường Linh Chiểu"),w("27388","Phường Linh Tây"),
    w("27391","Phường Linh Đông"),w("27394","Phường Bình Thọ"),w("27397","Phường Trường Thọ"),
    w("27400","Phường Long Bình"),w("27403","Phường Long Thạnh Mỹ"),w("27406","Phường Tân Phú"),
    w("27409","Phường Hiệp Phú"),w("27412","Phường Tăng Nhơn Phú A"),w("27415","Phường Tăng Nhơn Phú B"),
    w("27418","Phường Phước Long B"),w("27421","Phường Phước Long A"),w("27424","Phường Trường Thạnh"),
    w("27427","Phường Long Phước"),w("27430","Phường Long Trường"),w("27433","Phường Phước Bình"),
    w("27436","Phường Phú Hữu"),w("27439","Phường Thảo Điền"),w("27442","Phường An Phú"),
    w("27445","Phường An Khánh"),w("27448","Phường Bình Trưng Đông"),w("27451","Phường Bình Trưng Tây"),
    w("27454","Phường Cát Lái"),w("27457","Phường Thủ Thiêm"),w("27460","Phường An Lợi Đông"),
  ],
  "776": [ // Huyện Bình Chánh
    w("27463","Thị trấn Tân Túc"),w("27466","Xã Phạm Văn Hai"),w("27469","Xã Vĩnh Lộc A"),
    w("27472","Xã Vĩnh Lộc B"),w("27475","Xã Bình Lợi"),w("27478","Xã Lê Minh Xuân"),
    w("27481","Xã Tân Nhựt"),w("27484","Xã Tân Kiên"),w("27487","Xã Bình Hưng"),
    w("27490","Xã Phong Phú"),w("27493","Xã An Phú Tây"),w("27496","Xã Hưng Long"),
    w("27499","Xã Đa Phước"),w("27502","Xã Tân Quý Tây"),w("27505","Xã Bình Chánh"),
    w("27508","Xã Quy Đức"),
  ],
  "777": [ // Huyện Cần Giờ
    w("27511","Thị trấn Cần Thạnh"),w("27514","Xã Bình Khánh"),w("27517","Xã Tam Thôn Hiệp"),
    w("27520","Xã An Thới Đông"),w("27523","Xã Thạnh An"),w("27526","Xã Long Hòa"),
    w("27529","Xã Lý Nhơn"),
  ],
  "778": [ // Huyện Củ Chi
    w("27532","Thị trấn Củ Chi"),w("27535","Xã Phú Mỹ Hưng"),w("27538","Xã An Phú"),
    w("27541","Xã Trung Lập Thượng"),w("27544","Xã An Nhơn Tây"),w("27547","Xã Nhuận Đức"),
    w("27550","Xã Phạm Văn Cội"),w("27553","Xã Phú Hòa Đông"),w("27556","Xã Trung Lập Hạ"),
    w("27559","Xã Trung An"),w("27562","Xã Phước Thạnh"),w("27565","Xã Phước Hiệp"),
    w("27568","Xã Tân An Hội"),w("27571","Xã Phước Vĩnh An"),w("27574","Xã Thái Mỹ"),
    w("27577","Xã Tân Thạnh Tây"),w("27580","Xã Hòa Phú"),w("27583","Xã Tân Thạnh Đông"),
    w("27586","Xã Bình Mỹ"),w("27589","Xã Tân Phú Trung"),w("27592","Xã Tân Thông Hội"),
  ],
  "779": [ // Huyện Hóc Môn
    w("27595","Thị trấn Hóc Môn"),w("27598","Xã Tân Hiệp"),w("27601","Xã Nhị Bình"),
    w("27604","Xã Đông Thạnh"),w("27607","Xã Tân Thới Nhì"),w("27610","Xã Thới Tam Thôn"),
    w("27613","Xã Xuân Thới Sơn"),w("27616","Xã Tân Xuân"),w("27619","Xã Xuân Thới Đông"),
    w("27622","Xã Trung Chánh"),w("27625","Xã Xuân Thới Thượng"),w("27628","Xã Bà Điểm"),
  ],
  "780": [ // Huyện Nhà Bè
    w("27631","Thị trấn Nhà Bè"),w("27634","Xã Phước Kiển"),w("27637","Xã Phước Lộc"),
    w("27640","Xã Nhơn Đức"),w("27643","Xã Phú Xuân"),w("27646","Xã Long Thới"),
    w("27649","Xã Hiệp Phước"),
  ],

  // ── ĐÀ NẴNG ────────────────────────────────────────────────────────────
  "490": [ // Quận Hải Châu
    w("20194","Phường Thanh Bình"),w("20195","Phường Thuận Phước"),w("20197","Phường Thạch Thang"),
    w("20198","Phường Hải Châu 1"),w("20199","Phường Hải Châu 2"),w("20200","Phường Phước Ninh"),
    w("20201","Phường Hòa Thuận Tây"),w("20202","Phường Hòa Thuận Đông"),w("20203","Phường Nam Dương"),
    w("20204","Phường Bình Hiên"),w("20205","Phường Bình Thuận"),w("20206","Phường Hòa Cường Bắc"),
    w("20207","Phường Hòa Cường Nam"),
  ],
  "491": [ // Quận Cẩm Lệ
    w("20208","Phường Khuê Trung"),w("20209","Phường Hòa Phát"),w("20210","Phường Hòa An"),
    w("20211","Phường Hòa Thọ Tây"),w("20212","Phường Hòa Thọ Đông"),w("20213","Phường Hòa Xuân"),
  ],
  "492": [ // Quận Liên Chiểu
    w("20214","Phường Hòa Hiệp Bắc"),w("20215","Phường Hòa Hiệp Nam"),w("20216","Phường Hòa Khánh Bắc"),
    w("20217","Phường Hòa Khánh Nam"),w("20218","Phường Hòa Minh"),
  ],
  "493": [ // Quận Ngũ Hành Sơn
    w("20219","Phường Mỹ An"),w("20220","Phường Khuê Mỹ"),w("20221","Phường Hòa Quý"),
    w("20222","Phường Hòa Hải"),
  ],
  "494": [ // Quận Sơn Trà
    w("20223","Phường Thọ Quang"),w("20224","Phường Nại Hiên Đông"),w("20225","Phường Mân Thái"),
    w("20226","Phường An Hải Bắc"),w("20227","Phường Phước Mỹ"),w("20228","Phường An Hải Tây"),
    w("20229","Phường An Hải Đông"),
  ],
  "495": [ // Quận Thanh Khê
    w("20230","Phường Tam Thuận"),w("20231","Phường Thanh Khê Tây"),w("20232","Phường Thanh Khê Đông"),
    w("20233","Phường Xuân Hà"),w("20234","Phường Tân Chính"),w("20235","Phường Chính Gián"),
    w("20236","Phường Vĩnh Trung"),w("20237","Phường Thạc Gián"),w("20238","Phường An Khê"),
    w("20239","Phường Hòa Khê"),
  ],

  // ── HẢI PHÒNG ──────────────────────────────────────────────────────────
  "303": [ // Quận Hồng Bàng
    w("11233","Phường Quán Toan"),w("11236","Phường Hùng Vương"),w("11239","Phường Sở Dầu"),
    w("11242","Phường Thượng Lý"),w("11245","Phường Đông Khê"),w("11248","Phường Hoàng Văn Thụ"),
    w("11251","Phường Phan Bội Châu"),w("11254","Phường Minh Khai"),w("11257","Phường Trại Chuối"),
    w("11260","Phường Hạ Lý"),
  ],
  "304": [ // Quận Ngô Quyền
    w("11263","Phường Máy Chai"),w("11266","Phường Máy Tơ"),w("11269","Phường Vạn Mỹ"),
    w("11272","Phường Cầu Tre"),w("11275","Phường Lạc Viên"),w("11278","Phường Gia Viên"),
    w("11281","Phường Đông Khê"),w("11284","Phường Cầu Đất"),w("11287","Phường Lê Lợi"),
    w("11290","Phường Đằng Giang"),w("11293","Phường Lạch Tray"),w("11296","Phường Đổng Quốc Bình"),
  ],
  "305": [ // Quận Lê Chân
    w("11299","Phường An Biên"),w("11302","Phường An Dương"),w("11305","Phường Trần Nguyên Hãn"),
    w("11308","Phường Hồ Nam"),w("11311","Phường Lê Chân"),w("11314","Phường Đông Hải 2"),
    w("11317","Phường Niệm Nghĩa"),w("11320","Phường Nghĩa Xá"),w("11323","Phường Dư Hàng"),
    w("11326","Phường Hàng Kênh"),w("11329","Phường Đông Hải 1"),w("11332","Phường Lam Sơn"),
    w("11335","Phường Kênh Dương"),w("11338","Phường Vĩnh Niệm"),
  ],
  "306": [ // Quận Hải An
    w("11341","Phường Đông Hải 1"),w("11344","Phường Đông Hải 2"),w("11347","Phường Đằng Lâm"),
    w("11350","Phường Thành Tô"),w("11353","Phường Đằng Hải"),w("11356","Phường Nam Hải"),
    w("11359","Phường Cát Bi"),w("11362","Phường Tràng Cát"),
  ],
  "307": [ // Quận Kiến An
    w("11365","Phường Quán Trữ"),w("11368","Phường Lãm Hà"),w("11371","Phường Đồng Hòa"),
    w("11374","Phường Bắc Sơn"),w("11377","Phường Nam Sơn"),w("11380","Phường Ngọc Sơn"),
    w("11383","Phường Trần Thành Ngọ"),w("11386","Phường Văn Đẩu"),w("11389","Phường Phù Liễn"),
    w("11392","Phường Tràng Minh"),
  ],

  // ── CẦN THƠ ────────────────────────────────────────────────────────────
  "916": [ // Quận Ninh Kiều
    w("31150","Phường Cái Khế"),w("31153","Phường An Hòa"),w("31156","Phường Thới Bình"),
    w("31159","Phường An Nghiệp"),w("31162","Phường An Cư"),w("31165","Phường Tân An"),
    w("31168","Phường An Phú"),w("31171","Phường Xuân Khánh"),w("31174","Phường Hưng Lợi"),
    w("31177","Phường An Khánh"),w("31180","Phường An Bình"),
  ],
  "917": [ // Quận Ô Môn
    w("31183","Phường Châu Văn Liêm"),w("31186","Phường Thới Hòa"),w("31189","Phường Thới Long"),
    w("31192","Phường Long Hưng"),w("31195","Phường Thới An"),w("31198","Phường Phước Thới"),
    w("31201","Phường Trường Lạc"),
  ],
  "918": [ // Quận Bình Thủy
    w("31204","Phường Long Hòa"),w("31207","Phường Long Tuyền"),w("31210","Phường Lê Bình"),
    w("31213","Phường An Thới"),w("31216","Phường Bình Thủy"),w("31219","Phường Trà Nóc"),
    w("31222","Phường Thới An Đông"),w("31225","Phường Bùi Hữu Nghĩa"),
  ],
  "919": [ // Quận Cái Răng
    w("31228","Phường Lê Bình"),w("31231","Phường Hưng Phú"),w("31234","Phường Hưng Thạnh"),
    w("31237","Phường Ba Láng"),w("31240","Phường Thường Thạnh"),w("31243","Phường Phú Thứ"),
    w("31246","Phường Tân Phú"),
  ],
};
