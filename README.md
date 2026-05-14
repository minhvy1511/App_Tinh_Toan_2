# Vision ID Surgical Plan Web

Website Flask chuyển từ app Streamlit cũ sang mô hình frontend, backend và database.

## Chạy local

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Mở `http://127.0.0.1:5000`.

Local sẽ tự dùng SQLite tại `instance/app.db`.

## Deploy free

Backend và frontend nằm chung trong Flask app nên có thể deploy một service Python miễn phí.

1. Tạo database PostgreSQL miễn phí trên Neon hoặc Supabase.
2. Deploy repo này lên Render/Railway/Fly.io bằng Python web service.
3. Set biến môi trường `DATABASE_URL` bằng connection string PostgreSQL.
4. Start command: `gunicorn app:app`.

Nếu không set `DATABASE_URL`, app sẽ dùng SQLite. SQLite phù hợp chạy local, không nên dùng cho production miễn phí có filesystem tạm thời.

## Chức năng

- Tab `Tính toán nhanh`: tính một mắt.
- Tab `Lập kế hoạch`: nhập thông tin bệnh nhân, OD/OS, tính hai mắt và lưu kế hoạch.
- Công thức ablation, OZ factor, RSB, PTA, Post-op K và cảnh báo được chuyển từ `E:\App_Tinh_Toan\app.py`.
