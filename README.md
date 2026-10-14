# Galaxy Blackhole — bản desktop

Ứng dụng desktop **tự chứa**: không cần cài Node, không cần cài gì thêm. Trong gói có sẵn
Electron (runtime của app) và một bản Node riêng (để chạy phần lõi), nên máy đích chỉ việc mở lên.

## Tải về

Bản phát hành nằm ở [Releases](https://github.com/galaxy-blackhole/blackhole-desktop-electron/releases/latest).
Chọn đúng hệ và kiến trúc:

| Hệ | Tệp |
| --- | --- |
| macOS (Apple Silicon) | `Galaxy.Blackhole-<version>-arm64.dmg` |
| macOS (Intel) | `Galaxy.Blackhole-<version>.dmg` |
| Windows | `Galaxy.Blackhole.Setup.<version>.exe` |
| Linux | `Galaxy.Blackhole-<version>.AppImage` hoặc `blackhole-desktop-<version>.tar.gz` |

`SHA256SUMS.txt` đi kèm để kiểm tra tệp đã tải.

### Bản chưa ký số — máy sẽ cảnh báo, đây là cách mở

Chưa có Apple Developer ID và chứng thư Windows, nên hệ điều hành sẽ cảnh báo. Đây là chủ ý, không phải lỗi build:

- **macOS**: Finder → chuột phải vào app → **Mở** → **Mở** lần nữa. Nếu vẫn bị chặn:
  `xattr -dr com.apple.quarantine "/Applications/Galaxy Blackhole.app"`
- **Windows**: SmartScreen → **More info** → **Run anyway**.

### Nút “Kiểm tra nâng cấp…”

Nằm trong menu của app. Nó đọc ba version — bản desktop, bản CLI đi kèm, và bản CLI trên máy — rồi nâng cấp.
Trên Windows và Linux app thay tại chỗ; trên macOS (chưa ký) nó mở trang tải để bạn lấy dmg mới. Nếu máy đã có
`blackhole` thì nó nâng CLI lên **đúng version của bản desktop**, đọc lại để xác nhận, và **không bao giờ tự dùng
`sudo`** — khi npm từ chối vì quyền, nó hiện lệnh cho bạn.

## Dựng bản macOS

```bash
bash fix-electron.sh      # một lần: npm chặn postinstall của Electron, script này gỡ và giải nén đúng cách
bash build-release.sh     # dựng release/Galaxy-Blackhole.app  (tự chứa: app + node + cli)
bash package-dmg.sh       # dựng release/Galaxy-Blackhole.dmg  (giao cho create-dmg)
```

`package-dmg.sh` chỉ gọi `package-dmg-create.sh` — giữ tên quen thuộc, còn việc đặt bố cục là của
`create-dmg` (cần `brew install create-dmg`). Lý do: xem mục *Hai cái bẫy* bên dưới.

## Dựng bản Windows và Linux

```bash
bash build-cross.sh       # tải Electron chính thức + Node runtime, ghép thành:
#   release/cross/Galaxy-Blackhole-windows-x64.zip
#   release/cross/Galaxy-Blackhole-linux-x64.tar.gz
```

Hai gói này là **artifact**: cấu trúc đã kiểm (Electron thật, có `host/cli` và `host/bin/node`),
nhưng phải **cài thử trên chính hệ của nó** để nghiệm thu — máy dựng là macOS.

## Kết quả

| Gói | Dung lượng | Ghi chú |
|---|---|---|
| `.dmg` (macOS) | ~279 MB | mở ra: app **bên trái**, `Applications` **bên phải**, icon 128px |
| `.zip` (Windows x64) | ~310 MB | Electron thật + Node runtime |
| `.tar.gz` (Linux x64) | ~278 MB | Electron thật + Node runtime |

## Hai cái bẫy đã trả giá

**1. npm chặn postinstall của Electron.** `npm install electron` chạy xong mà `Electron.app` chỉ là
vỏ rỗng vài trăm KB. `fix-electron.sh` gỡ chặn, chạy lại `npm rebuild`, rồi giải nén bằng `ditto` và
ghi `path.txt` — `echo` ghi kèm ký tự xuống dòng nên Node không tìm thấy đường dẫn.

**2. Finder từ chối đặt bố cục, và từ chối rất im lặng.** `hdiutil` + AppleScript đã thử và thất bại
nhiều lần: lỗi `-10006` (item chưa tồn tại) trông y như lỗi quyền; Finder còn **nhớ tên cũ theo volume**
nên nó từ chối một cái tên mà `ls` vẫn thấy. Cuối cùng `create-dmg` làm xong trong **18 giây**.
Bài học: một thất bại bị nuốt vào `/dev/null` sẽ khiến bạn đoán sai nhiều lần liền.

## Cấu trúc trong app

```
Galaxy Blackhole.app/Contents/Resources/
  app/                 phần vỏ Electron (main.js, splash) + phần tự chứa:
  app/host/cli/        CLI đã đóng gói (blackhole) — dist, licenses, node_modules
  app/host/bin/node    Node runtime riêng (142 MB) — máy đích KHÔNG cần cài Node
```

Kiểm chứng tự chứa (đã đo, không phải suy đoán):

```bash
ls release/Galaxy-Blackhole.app/Contents/Resources/app/host/bin/node   # 142 MB, chạy được
# và trong chính ảnh cài:
ls "/Volumes/Galaxy Blackhole/Galaxy Blackhole.app/Contents/Resources/app/host/bin/node"
```

App tự chạy host của chính nó (`main.js` khởi động `host/cli` bằng `host/bin/node`), nên mở app là
có ngay giao diện, không cần bật server nào trước.
