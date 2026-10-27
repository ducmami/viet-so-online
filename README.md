# Việt Lạc Sớ trên web

Bản web đọc và ghi MongoDB Atlas, database `vls`. Biến kết nối nằm ở `.env` gốc của repo: `MONGODB_URI`, `MONGODB_USERNAME`, `MONGODB_PASSWORD`.

## Chạy

```powershell
npm run install:all
npm run dev
```

Giao diện: http://127.0.0.1:5173  
API: http://127.0.0.1:4010

## Nạp dữ liệu

Lệnh đọc NDJSON trong `mongo-export`, giữ `_id`, nạp các collection nhỏ trước rồi `longsos`. Nếu Atlas hết dung lượng, lệnh dừng và in số document đã ghi.

```powershell
npm run import
```
