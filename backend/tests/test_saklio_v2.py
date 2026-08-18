"""
Saklio iteration-2 backend tests.
Covers new endpoints: /fx/rates, notify prefs, share create/get/accept,
documents CRUD (re-verify), account export, account request-reset + confirm-reset,
and confirms welcome email path does not break /auth/register.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://ownership-os-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------------- fixtures ----------------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _register(session, prefix="v2"):
    email = f"test+{prefix}{uuid.uuid4().hex[:8]}@saklio.app"
    r = session.post(f"{API}/auth/register", json={"name": f"TEST {prefix}", "email": email, "password": "test1234"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"email": email, "token": d["token"], "user": d["user"]}


@pytest.fixture(scope="session")
def userA(session):
    return _register(session, "A")


@pytest.fixture(scope="session")
def userB(session):
    return _register(session, "B")


@pytest.fixture(scope="session")
def headersA(userA):
    return {"Authorization": f"Bearer {userA['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def headersB(userB):
    return {"Authorization": f"Bearer {userB['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def seeded_product(session, headersA):
    """Seed 4 demo products for userA and return the first one."""
    r = session.post(f"{API}/seed-demo", headers=headersA)
    assert r.status_code == 200
    lst = session.get(f"{API}/products", headers=headersA).json()
    assert len(lst) >= 1
    return lst[0]


# ---------------- Register welcome-email path ----------------
class TestRegisterStillWorks:
    def test_register_returns_token_even_if_smtp_fails(self, session):
        # If SMTP fails inside preview, /auth/register should NOT 500 — it must return token.
        email = f"test+reg{uuid.uuid4().hex[:8]}@saklio.app"
        r = session.post(f"{API}/auth/register", json={"name": "Reg Test", "email": email, "password": "test1234"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert "token" in j and "user" in j
        assert j["user"]["email"] == email


# ---------------- FX ----------------
class TestFX:
    def test_fx_rates(self, session):
        r = session.get(f"{API}/fx/rates")
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("base") == "USD"
        rates = j.get("rates", {})
        # Must include all symbols we care about
        for sym in ("TRY", "USD", "EUR", "SEK", "DKK"):
            assert sym in rates, f"missing {sym} in {rates}"
            assert isinstance(rates[sym], (int, float))
            assert rates[sym] > 0
        # sanity: TRY:USD > 5 typically (fallback is 39.0, live ~30-50)
        assert rates["TRY"] > 5

    def test_fx_rates_cached(self, session):
        # Second call within an hour should be cached
        r = session.get(f"{API}/fx/rates")
        assert r.status_code == 200
        j = r.json()
        # cached may be True on second call
        assert "rates" in j


# ---------------- Notify prefs ----------------
class TestNotifyPrefs:
    def test_update_notify_return_false(self, session, headersA, seeded_product):
        pid = seeded_product["id"]
        r = session.put(f"{API}/products/{pid}/notify", json={"notify_return": False}, headers=headersA)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["id"] == pid
        assert j.get("notify_return") is False

        # verify persistence via GET
        g = session.get(f"{API}/products/{pid}", headers=headersA)
        assert g.status_code == 200
        assert g.json().get("notify_return") is False

    def test_update_notify_warranty_false(self, session, headersA, seeded_product):
        pid = seeded_product["id"]
        r = session.put(f"{API}/products/{pid}/notify", json={"notify_warranty": False}, headers=headersA)
        assert r.status_code == 200
        assert r.json().get("notify_warranty") is False

    def test_notify_not_owner_returns_404(self, session, headersB, seeded_product):
        pid = seeded_product["id"]
        r = session.put(f"{API}/products/{pid}/notify", json={"notify_return": False}, headers=headersB)
        assert r.status_code == 404


# ---------------- Share ----------------
class TestShare:
    def test_share_create(self, session, headersA, seeded_product):
        pid = seeded_product["id"]
        r = session.post(f"{API}/products/{pid}/share", headers=headersA)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "token" in j and len(j["token"]) >= 8
        assert j.get("deeplink") == f"saklio://share/{j['token']}"
        pytest.share_token = j["token"]
        pytest.share_product_name = seeded_product["name"]

    def test_share_get(self, session, headersB):
        # anyone authenticated can view share
        token = pytest.share_token
        r = session.get(f"{API}/share/{token}", headers=headersB)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "from_name" in j
        prod = j.get("product", {})
        assert prod.get("name") == pytest.share_product_name
        # computed status fields present
        assert "return_status" in prod

    def test_share_get_not_found(self, session, headersA):
        r = session.get(f"{API}/share/nonexistent_token_xxx", headers=headersA)
        assert r.status_code == 404

    def test_share_accept_clones_into_userB(self, session, userB, headersB):
        token = pytest.share_token
        # count userB products before
        before = session.get(f"{API}/products", headers=headersB).json()
        n_before = len(before)

        r = session.post(f"{API}/share/{token}/accept", headers=headersB)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("name") == pytest.share_product_name
        assert j.get("owner_id") == userB["user"]["id"]
        assert j.get("source") == "share"
        new_id = j["id"]

        # verify persistence
        after = session.get(f"{API}/products", headers=headersB).json()
        assert len(after) == n_before + 1
        assert any(p["id"] == new_id for p in after)


# ---------------- Documents (re-verify) ----------------
class TestDocuments:
    def test_add_list_delete_document(self, session, headersA, seeded_product):
        pid = seeded_product["id"]
        payload = {"type": "fis", "name": "TEST_fis.jpg", "file_path": "test/fake/path.jpg"}
        r = session.post(f"{API}/products/{pid}/documents", json=payload, headers=headersA)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["type"] == "fis"
        assert doc["name"] == "TEST_fis.jpg"
        assert doc["product_id"] == pid
        doc_id = doc["id"]

        # list
        lst = session.get(f"{API}/products/{pid}/documents", headers=headersA)
        assert lst.status_code == 200
        assert any(d["id"] == doc_id for d in lst.json())

        # delete
        d = session.delete(f"{API}/documents/{doc_id}", headers=headersA)
        assert d.status_code == 200
        assert d.json().get("ok") is True

        # verify removed
        lst2 = session.get(f"{API}/products/{pid}/documents", headers=headersA)
        assert not any(d["id"] == doc_id for d in lst2.json())

    def test_add_document_bad_product(self, session, headersA):
        r = session.post(f"{API}/products/no-such-id/documents",
                         json={"type": "fis", "file_path": "x"}, headers=headersA)
        assert r.status_code == 404


# ---------------- Data export ----------------
class TestExport:
    def test_export(self, session, userA, headersA, seeded_product):
        r = session.post(f"{API}/account/export", headers=headersA)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "sent" in j and isinstance(j["sent"], bool)  # sent:false acceptable
        assert j.get("email", "").lower() == userA["email"].lower()
        counts = j.get("counts", {})
        assert "products" in counts and "documents" in counts
        assert isinstance(counts["products"], int)
        assert isinstance(counts["documents"], int)
        assert counts["products"] >= 1  # userA has seeded products


# ---------------- Data reset flow ----------------
class TestResetFlow:
    """Full flow: create fresh user, seed, request-reset -> get debug_code,
    confirm-reset with wrong code -> 400, then correct code -> 200 and empty products."""

    def test_full_reset_flow(self, session):
        # brand-new user so we don't wipe other tests
        u = _register(session, "reset")
        h = {"Authorization": f"Bearer {u['token']}", "Content-Type": "application/json"}

        # seed
        s = session.post(f"{API}/seed-demo", headers=h)
        assert s.status_code == 200
        pre = session.get(f"{API}/products", headers=h).json()
        assert len(pre) == 4

        # request-reset
        r = session.post(f"{API}/account/request-reset", headers=h)
        assert r.status_code == 200, r.text
        rj = r.json()
        assert "sent" in rj
        assert rj.get("email") == u["email"]
        assert "debug_code" in rj, "EMAIL_DEBUG=true should surface debug_code"
        code = rj["debug_code"]
        assert len(code) == 6 and code.isdigit()

        # wrong code -> 400
        bad = session.post(f"{API}/account/confirm-reset", json={"code": "000000" if code != "000000" else "111111"}, headers=h)
        assert bad.status_code == 400, bad.text

        # correct code -> 200 ok:true
        ok = session.post(f"{API}/account/confirm-reset", json={"code": code}, headers=h)
        assert ok.status_code == 200, ok.text
        assert ok.json().get("ok") is True

        # verify products list is empty
        post = session.get(f"{API}/products", headers=h).json()
        assert post == []

    def test_confirm_without_request(self, session):
        u = _register(session, "noreq")
        h = {"Authorization": f"Bearer {u['token']}", "Content-Type": "application/json"}
        r = session.post(f"{API}/account/confirm-reset", json={"code": "123456"}, headers=h)
        assert r.status_code == 400
