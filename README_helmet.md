# Adventure / Full-face Helmet — 3D Model

## Deliverables

| File | Mô tả |
|---|---|
| `create_helmet.py` | Script Python tạo toàn bộ model |
| `helmet_model.blend` | Blender project — có modifier, material, camera, light |
| `helmet_model.glb` | Export dùng cho web (Three.js, Babylon.js, Unity, Godot…) |
| `preview.png` | Render PNG 1024×1024 (chạy sau khi script xong) |

---

## Cách chạy script

### Với UI (mở Blender bình thường)
```
blender --python create_helmet.py
```

### Headless (không UI, dùng trong CI / build pipeline)
```
blender -b --python create_helmet.py
```

### Thay đổi thư mục output
Mở `create_helmet.py`, chỉnh dòng:
```python
OUTPUT_DIR = r"s:\project\bigbike"   # ← đổi thành path bạn muốn
```

---

## Cấu trúc model

```
Scene
├── Helmet_Shell (collection)
│   └── Shell               ← vỏ chính, UV sphere deformed + Bevel + Subdivision
│
├── Visor (collection)
│   └── Visor               ← kính chắn gió cong, parametric grid + Solidify
│
├── Details (collection)
│   ├── Chin                ← chin guard góc cạnh adventure-style
│   ├── Peak                ← top peak / sun visor nhô ra phía trước
│   ├── Vent                ← cụm thông gió trán (housing)
│   ├── Slot-0.13/0.0/0.13  ← 3 khe grille kim loại
│   ├── Cheek_L / Cheek_R   ← panel má hai bên (curved grid + Solidify)
│   ├── LowerTrim           ← viền cao su viền dưới
│   ├── Screw00–05          ← đinh vít tại các khớp nối
│   ├── Red_L / Red_R       ← accent đỏ phía sau-dưới
│   └── Fin_L0/L1/R0/R1     ← chi tiết fin gunmetal phía sau
│
├── Lighting (collection)
│   ├── L_Key   — area light chính (key light)
│   ├── L_Fill  — area light fill mềm
│   ├── L_Rim   — area light rim (viền sáng phía sau)
│   └── L_Top   — area light trên đầu
│
└── Camera (collection)
    └── Cam  — 70mm, góc 3/4 front-left giống ảnh tham chiếu
```

---

## Vật liệu

| Key | Tên | Mô tả |
|---|---|---|
| `M_Shell` | Glossy white | Roughness 0.07, metallic 0.04 — trắng ngọc bóng |
| `M_Black` | Matte black | Roughness 0.78 — đen mờ cho panels/chin |
| `M_Gun` | Gunmetal | Metallic 0.80, roughness 0.28 — kim loại xám |
| `M_Visor` | Smoky glass | Transmission 0.90, alpha 0.20 — kính khói trong suốt |
| `M_Red` | Red accent | Roughness 0.22 — accent đỏ |
| `M_Screw` | Screw metal | Metallic 0.95 — đinh vít chrome |
| `M_Rubber` | Rubber trim | Roughness 0.98 — cao su viền |

---

## Cách chỉnh hình dáng để giống ảnh hơn

### Shell (vỏ chính)
Mở `create_shell()` trong script, chỉnh các hệ số deform:
```python
nx = x * 1.09     # tăng = rộng hơn, giảm = hẹp hơn
ny = y * 0.94     # tăng = dài hơn trước-sau
nz = z * 1.18     # tăng = cao hơn phần trên
# Rear lean (ngả ra sau)
ny -= (z - 0.4) * 0.10   # tăng số 0.10 = ngả nhiều hơn
# Chin protrusion (cằm nhô ra)
ny += (y-0.15)*0.35*…    # tăng 0.35 = cằm nhô nhiều hơn
```
Sau đó xoá bottom thấp hơn: `v.co.z < -0.40` → đổi -0.40 để mở rộng/thu hẹp neck opening.

### Chin Guard
Sửa 8 điểm trong `create_chin()`:
- Tăng Y để chin nhô ra phía trước hơn
- Tăng Z để chin cao hơn / che nhiều hơn

### Peak (mái che)
Sửa 8 điểm trong `create_peak()`:
- Y của "front top/bottom" (0.98) = độ nhô ra; tăng để dài hơn
- Z của "front bottom" (0.46) = góc nghiêng xuống

### Visor (kính)
Trong `create_visor()`:
```python
ax = (u - 0.5) * math.radians(80)  # 80° = độ rộng kính; giảm = kính hẹp hơn
az = math.radians(-28) + vt * math.radians(66)  # -28° = đáy kính, +66° = chiều cao
```

### Cheek panels
Trong `create_cheek_panels()`:
```python
ah = math.radians(28) + u * math.radians(58)  # góc bắt đầu / kết thúc panel má
av = math.radians(-42) + vt * math.radians(56) # phạm vi theo chiều dọc
```

---

## Render PNG

Script tự render nếu không truyền `skip_render=True`. Để render thủ công từ Blender:
```
blender -b helmet_model.blend --render-output //preview.png --render-frame 1
```
Hoặc trong Blender UI: `Render → Render Image` (F12), sau đó `Image → Save As`.

---

## Dùng .glb trong Three.js

```js
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

const loader = new GLTFLoader()
loader.load('helmet_model.glb', (gltf) => {
  scene.add(gltf.scene)
})
```
