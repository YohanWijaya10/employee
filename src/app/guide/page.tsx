export default function GuidePage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl guide-hero p-6 border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <h1 className="text-2xl font-bold text-text">Introduction & Guide</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Ringkas cara pakai dan cara baca aplikasi Sales & Distribution Monitoring.</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-2">Apa Ini?</h2>
        <p className="text-text">
          Aplikasi ini memantau penjualan dan distribusi, lengkap dengan deteksi pola berisiko (anti‑fraud) dan ringkasan AI.
          Anda bisa melihat KPI, daftar order, performa sales rep dan outlet, serta menjalankan analisis risiko.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold mb-2">Dashboard</h3>
          <ul className="list-disc list-inside text-text space-y-1 marker:text-muted">
            <li>Total Orders, Delivered, Cancelled, Total Revenue (30 hari default).</li>
            <li>&quot;Sales Reps by Cancel Rate&quot; menyorot rep dengan cancel rate tinggi.</li>
            <li>Order Status Distribution menunjukkan proporsi status order.</li>
            <li>Recent Audit Flags menampilkan flag terbaru dari deteksi risiko.</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-2">Orders</h3>
          <ul className="list-disc list-inside text-text space-y-1 marker:text-muted">
            <li>Filter status (Created/Ready/Delivered/Cancelled) dan pagination.</li>
            <li>Klik nomor order untuk masuk ke detail.</li>
            <li>Kolom jumlah menampilkan nilai dalam format mata uang.</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-2">Sales Reps</h3>
          <ul className="list-disc list-inside text-text space-y-1 marker:text-muted">
            <li>Cancel Rate: persentase pembatalan dari total order (90 hari).</li>
            <li>Badge warna: hijau (bagus), kuning (warning), merah (tinggi).</li>
            <li>High Risk: cancel rate &gt; 25% dengan sampel order memadai.</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-2">Outlets</h3>
          <ul className="list-disc list-inside text-text space-y-1 marker:text-muted">
            <li>Performa outlet (orders, revenue, cancel rate) dalam 90 hari.</li>
            <li>Breakdown per tipe outlet dan status aktif/non-aktif.</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-2">Anti‑Fraud Report</h2>
        <ul className="list-disc list-inside text-text space-y-1 marker:text-muted">
          <li>Set periode tanggal lalu klik &quot;Run Fraud Detection&quot; untuk membuat flag.</li>
          <li>Klik &quot;Generate AI Summary&quot; untuk ringkasan AI yang merangkum metrik, pola risiko, dan checklist investigasi.</li>
          <li>Flag Severity: INFO (biru), WARN (kuning), HIGH (merah).</li>
          <li>Contoh pola: cancel rate tinggi (&gt;15% WARN, &gt;25% HIGH), spike akhir bulan, pre-ship cancellations, ukuran order abnormal.</li>
        </ul>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-2">Tabel & Interaksi</h2>
        <ul className="list-disc list-inside text-text space-y-1 marker:text-muted">
          <li>Klik baris/tautan biru untuk membuka detail (mis. nomor order).</li>
          <li>Nilai uang diformat otomatis; badge warna membantu prioritas.</li>
          <li>Kursi kosong &quot;-&quot; berarti data belum tersedia/irrelevan.</li>
        </ul>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-2">Tips & Catatan</h2>
        <ul className="list-disc list-inside text-text space-y-1 marker:text-muted">
          <li>Default range: 30 hari (dashboard) dan 90 hari (rep/outlet).</li>
          <li>AI tidak pernah memastikan fraud; hanya indikator risiko untuk ditindaklanjuti.</li>
          <li>API internal dilindungi header <span className="font-mono">X-API-KEY</span> (untuk S2S). UI internal tidak mengirim key dari browser.</li>
          <li>Jika data terasa lambat, jalankan seeding atau periksa koneksi database.</li>
        </ul>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-2">Cepat Mulai</h2>
        <ol className="list-decimal list-inside text-text space-y-1 marker:text-muted">
          <li>Buka Dashboard untuk gambaran umum.</li>
          <li>Cek Sales Reps dan Outlets untuk cancel rate tinggi.</li>
          <li>Buka Anti‑Fraud Report → jalankan &quot;Run Fraud Detection&quot;.</li>
          <li>Generate AI Summary untuk ringkasannya dan checklist investigasi.</li>
          <li>Telusuri Orders untuk verifikasi detail transaksi.</li>
        </ol>
      </div>
    </div>
  );
}
