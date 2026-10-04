// Netlify Function: kelola akun (hanya bisa dipakai oleh akun kepala tahfidz).
// Butuh environment variable: SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY
// (kunci service role JANGAN pernah ditaruh di file frontend).

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const json = (statusCode, obj) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(obj),
});

const adminHeaders = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

// Pastikan pemanggil adalah kepala yang aktif
async function verifyKepala(token) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const user = await r.json();
  const pr = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=role,aktif`,
    { headers: adminHeaders }
  );
  if (!pr.ok) return null;
  const rows = await pr.json();
  const p = rows[0];
  return p && p.aktif && p.role === "kepala" ? user : null;
}

async function errMsg(r, fallback) {
  try {
    const j = await r.json();
    return j.msg || j.message || j.error_description || j.error || fallback;
  } catch (e) {
    return fallback;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !KEY) {
    return json(500, { error: "Server belum dikonfigurasi (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)." });
  }

  const auth = event.headers.authorization || event.headers.Authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Belum login." });

  const caller = await verifyKepala(token);
  if (!caller) return json(403, { error: "Hanya kepala tahfidz yang boleh mengelola akun." });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "Data tidak valid." });
  }

  try {
    switch (body.action) {
      case "create": {
        const nama = String(body.nama || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        const role = body.role === "kepala" ? "kepala" : "guru";
        if (!nama || !email) return json(400, { error: "Nama dan email wajib diisi." });
        if (password.length < 6) return json(400, { error: "Password minimal 6 karakter." });

        const cr = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
          method: "POST",
          headers: adminHeaders,
          body: JSON.stringify({ email, password, email_confirm: true }),
        });
        if (!cr.ok) return json(400, { error: await errMsg(cr, "Gagal membuat akun.") });
        const created = await cr.json();

        const pr = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
          method: "POST",
          headers: { ...adminHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ id: created.id, nama, email, role, aktif: true }),
        });
        if (!pr.ok) {
          // batalkan akun auth supaya tidak menggantung
          await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${created.id}`, {
            method: "DELETE",
            headers: adminHeaders,
          });
          return json(400, { error: await errMsg(pr, "Gagal menyimpan profil.") });
        }
        return json(200, { ok: true, id: created.id });
      }

      case "reset_password": {
        const id = String(body.id || "");
        const password = String(body.password || "");
        if (!id) return json(400, { error: "ID akun kosong." });
        if (password.length < 6) return json(400, { error: "Password minimal 6 karakter." });
        const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
          method: "PUT",
          headers: adminHeaders,
          body: JSON.stringify({ password }),
        });
        if (!r.ok) return json(400, { error: await errMsg(r, "Gagal reset password.") });
        return json(200, { ok: true });
      }

      case "set_aktif": {
        const id = String(body.id || "");
        const aktif = !!body.aktif;
        if (!id) return json(400, { error: "ID akun kosong." });
        if (id === caller.id) return json(400, { error: "Kamu tidak bisa menonaktifkan akunmu sendiri." });

        const pr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
          method: "PATCH",
          headers: { ...adminHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ aktif }),
        });
        if (!pr.ok) return json(400, { error: await errMsg(pr, "Gagal mengubah status.") });

        // blokir/buka login di sisi Supabase Auth juga
        const ur = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
          method: "PUT",
          headers: adminHeaders,
          body: JSON.stringify({ ban_duration: aktif ? "none" : "876000h" }),
        });
        if (!ur.ok) return json(400, { error: await errMsg(ur, "Gagal mengubah status login.") });
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: "Aksi tidak dikenal." });
    }
  } catch (e) {
    return json(500, { error: "Terjadi kesalahan server." });
  }
};
