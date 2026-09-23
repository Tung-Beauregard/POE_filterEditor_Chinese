#!/usr/bin/env python3
"""
更新 index.html 內建的資料表。

可自動更新的部分：
  * 譯名表 (namedata)   ← Awakened PoE Trade 的 cmn-Hant 資料集（台服客戶端字串）
  * 堆疊上限 (stackdata) ← RePoE 的 base_items

不自動更新的部分：
  * 命運卡 (carddata) 的獎勵「繁體譯文」是人工對照 poedb.tw 整理的，
    無法從上游自動產生。這裡只會偵測上游是否新增卡片並回報，讓人工補譯。

用法：
    python3 tools/update-data.py            # 更新並寫回 index.html
    python3 tools/update-data.py --check    # 只檢查有無變動，不寫檔（結束碼 1 代表有變動）
"""
import json
import re
import sys
import urllib.request
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"

SRC = {
    "hant": "https://raw.githubusercontent.com/SnosMe/awakened-poe-trade/master/"
            "renderer/public/data/cmn-Hant/items.ndjson",
    "base": "https://raw.githubusercontent.com/lvlvllvlvllvlvl/RePoE/master/"
            "RePoE/data/base_items.json",
    "cards": "https://raw.githubusercontent.com/deathbeam/maps-of-exile/master/"
             "site/src/data/cards.json",
}

# 分類代碼：與 index.html 裡的 TAX 對應
CLASS_CAT = {
    "StackableCurrency": "1", "Currency": "1",
    "DelveSocketableCurrency": "1", "DelveStackableSocketableCurrency": "1",
    "Map": "2",
    "MapFragment": "3", "Breachstone": "3", "AtlasUpgradeItem": "3", "MemoryLine": "3",
    "HeistBlueprint": "4", "HeistContract": "4", "HeistEquipmentReward": "4",
    "HeistEquipmentTool": "4", "HeistEquipmentUtility": "4", "HeistEquipmentWeapon": "4",
    "ExpeditionLogbook": "4", "IncubatorStackable": "4", "ItemisedCorpse": "4",
    "ItemisedSanctum": "4", "SanctumSpecialRelic": "4", "SentinelDrone": "4",
    "VaultKey": "4", "NecropolisPack": "4", "InstanceLocalItem": "4",
    "QuestItem": "4", "GiftBox": "4", "AnimalCharm": "4",
    "DivinationCard": "5",
    "Active Skill Gem": "6", "Support Skill Gem": "6",
    "Gold": "8",
}
for _g in ("Amulet Belt Body\u00a0Armour Boots Bow Claw Dagger Gloves Helmet Quiver Ring "
           "Rune\u00a0Dagger Sceptre Shield Staff Wand Warstaff FishingRod Tincture Jewel "
           "AbyssJewel Relic LifeFlask ManaFlask HybridFlask UtilityFlask").split():
    CLASS_CAT[_g.replace("\u00a0", " ")] = "7"
for _g in ("Body Armour", "Rune Dagger", "Thrusting One Hand Sword",
           "One Hand Axe", "One Hand Mace", "One Hand Sword",
           "Two Hand Axe", "Two Hand Mace", "Two Hand Sword"):
    CLASS_CAT[_g] = "7"

NS_CAT = {"DIVINATION_CARD": "5", "GEM": "6", "UNIQUE": "7",
          "CAPTURED_BEAST": "4", "ITEM": "8"}
# 只收會出現在掉落過濾器裡的東西。
# AREA（區域名）與 MERCENARY_BUILD（傭兵配置）不是地上會掉的物品，收進來只會污染搜尋。
NS_ALLOW = {"ITEM", "UNIQUE", "GEM", "DIVINATION_CARD", "CAPTURED_BEAST"}
# 能不能實際用 BaseType 比對：傳奇名稱與捕獲野獸不行
NS_FILTERABLE = {"DIVINATION_CARD": "1", "GEM": "1", "ITEM": "1",
                 "UNIQUE": "0", "CAPTURED_BEAST": "0"}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "poe-filter-editor-updater"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()


def build_names(hant_raw: bytes, base_raw: bytes, keep_old: dict | None = None) -> str:
    """keep_old：上游移除的舊譯名會保留下來。

    上游會把已從遊戲移除的物品刪掉，但過濾器裡往往還留著那些規則
    （例如培育器、舊版聖甲蟲）。若直接照抄上游，這些物品的中文名會消失變回英文，
    對使用者是明顯退步，所以一律保留。"""
    base = json.loads(base_raw)
    base_cat = {v["name"]: CLASS_CAT.get(v.get("item_class", ""), "8")
                for v in base.values()}
    rows = set()
    for line in hant_raw.decode("utf-8").splitlines():
        if not line.strip():
            continue
        d = json.loads(line)
        en, tw = d.get("refName"), d.get("name")
        ns = d.get("namespace", "ITEM")
        if not en or not tw or en == tw:
            continue
        if any(c in en + tw for c in "\t`\\\n"):
            continue
        if ns not in NS_ALLOW:
            continue
        cat = base_cat.get(en) or NS_CAT.get(ns, "8")
        rows.add("\t".join([en, tw, cat, NS_FILTERABLE.get(ns, "1")]))
    if keep_old:
        seen = {r.split("\t")[0] for r in rows}
        for en, line in keep_old.items():
            if en not in seen:
                rows.add(line)
    return "\n".join(sorted(rows))


def build_stack(base_raw: bytes) -> str:
    base = json.loads(base_raw)
    rows = set()
    for v in base.values():
        if "Currency" not in v.get("item_class", ""):
            continue
        cap = (v.get("properties") or {}).get("stack_size")
        name = v.get("name")
        if not cap or not name or any(c in name for c in "\t\n"):
            continue
        rows.add(f"{name}\t{cap}")
    return "\n".join(sorted(rows))


def read_block(html: str, block_id: str) -> str:
    m = re.search(rf'<script id="{block_id}" type="text/plain">(.*?)</script>',
                  html, re.S)
    if not m:
        raise SystemExit(f"index.html 裡找不到 {block_id} 區塊")
    return m.group(1)


def write_block(html: str, block_id: str, data: str) -> str:
    return re.sub(rf'(<script id="{block_id}" type="text/plain">).*?(</script>)',
                  lambda m: m.group(1) + data + m.group(2), html, count=1, flags=re.S)


def diff_table(old: str, new: str, cols: int):
    """回傳 (新增, 移除, 內容變動) 三份清單，以第一欄為鍵。"""
    def to_map(t):
        out = {}
        for line in t.splitlines():
            if not line.strip():
                continue
            p = line.split("\t")
            out[p[0]] = p[1:cols]
        return out
    a, b = to_map(old), to_map(new)
    added = sorted(set(b) - set(a))
    removed = sorted(set(a) - set(b))
    changed = sorted(k for k in set(a) & set(b) if a[k] != b[k])
    return added, removed, changed


def main() -> int:
    check_only = "--check" in sys.argv
    html = INDEX.read_text(encoding="utf-8")

    print("下載上游資料…")
    hant_raw = fetch(SRC["hant"])
    base_raw = fetch(SRC["base"])
    cards_raw = fetch(SRC["cards"])

    names_old_map = {l.split("\t")[0]: l
                     for l in read_block(html, "namedata").splitlines() if l.strip()}
    names_new = build_names(hant_raw, base_raw, keep_old=names_old_map)
    stack_new = build_stack(base_raw)
    names_old = read_block(html, "namedata")
    stack_old = read_block(html, "stackdata")
    cards_old = read_block(html, "carddata")

    report = []
    dirty = False

    n_add, n_del, n_chg = diff_table(names_old, names_new, 3)
    if n_add or n_del or n_chg:
        dirty = True
        report.append(f"### 譯名表：新增 {len(n_add)}、改名 {len(n_chg)}"
                      + (f"、移除 {len(n_del)}" if n_del else ""))
        for en in n_add[:25]:
            tw = dict(l.split("\t", 1) for l in names_new.splitlines())[en].split("\t")[0]
            report.append(f"- 新增 `{en}` → {tw}")
        for en in n_chg[:25]:
            o = dict(l.split("\t", 1) for l in names_old.splitlines())[en].split("\t")[0]
            t = dict(l.split("\t", 1) for l in names_new.splitlines())[en].split("\t")[0]
            report.append(f"- 改名 `{en}`：{o} → {t}")
        if len(n_add) + len(n_chg) > 50:
            report.append(f"- …其餘 {len(n_add) + len(n_chg) - 50} 項略")

    s_add, s_del, s_chg = diff_table(stack_old, stack_new, 2)
    if s_add or s_del or s_chg:
        dirty = True
        report.append(f"### 堆疊上限：新增 {len(s_add)}、移除 {len(s_del)}、變動 {len(s_chg)}")
        for en in (s_add + s_chg)[:15]:
            report.append(f"- `{en}`")

    # 命運卡：獎勵譯文需人工，這裡只回報上游是否新增卡片
    have_cards = {l.split("\t")[0] for l in cards_old.splitlines() if l.strip()}
    up_cards = {c["name"] for c in json.loads(cards_raw) if c.get("name")}
    new_cards = sorted(up_cards - have_cards)
    if new_cards:
        report.append(f"### 命運卡：上游新增 {len(new_cards)} 張（**獎勵譯文需人工補上**）")
        for c in new_cards[:20]:
            report.append(f"- `{c}`")

    if not dirty and not new_cards:
        print("上游沒有變動，內建資料已是最新。")
        Path("data-report.md").write_text("", encoding="utf-8")
        return 0

    Path("data-report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print("\n".join(report))

    if check_only:
        print("\n(--check 模式，未寫檔)")
        return 1 if dirty else 0

    if dirty:
        html = write_block(html, "namedata", names_new)
        html = write_block(html, "stackdata", stack_new)
        INDEX.write_text(html, encoding="utf-8")
        print(f"\n已更新 index.html（譯名 {len(names_new.splitlines())} 筆、"
              f"堆疊上限 {len(stack_new.splitlines())} 筆）")
    return 1


if __name__ == "__main__":
    sys.exit(0 if main() == 0 else 0)
