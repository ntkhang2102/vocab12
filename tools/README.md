# Công cụ dựng nội dung (dành cho người bảo trì)

Yêu cầu: Python 3 + `pip install python-docx`.

```
# Dựng lại toàn bộ (file sách .docx đặt ở thư mục riêng, KHÔNG để trong kho công khai)
python3 tools/build_all.py /đường/dẫn/thư-mục-sách

# Kiểm tra một file sách, xuất ra thư mục tạm
python3 tools/parse_unit.py /đường/dẫn/Unit3_Part2.docx --out /tmp/out
```

- `ready.json`: danh sách Unit mở cho học sinh.
- `changes.json`: ghi chú “Có gì mới” cho app và cho từng Unit (khóa `units.<id>.version` phải khớp phiên bản nội dung mới).
- `translations/<id>.txt`: bản dịch câu/cụm cho mục Đọc bài (Claude soạn, GV duyệt; thêm dòng `@by gv` khi đã duyệt).
- Mỗi lần chạy, công cụ in cảnh báo (WARN) nếu thiếu từ, thiếu phương án, đáp án nhanh lệch lời giải, cụm dịch không ghép lại đúng câu gốc…
