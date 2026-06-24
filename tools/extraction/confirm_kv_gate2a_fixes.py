import json, glob
cards = {}
for p in glob.glob("content-packs/kv/mechanics/*.json"):
    d = json.load(open(p, encoding="utf-8")); cards[d["id"]] = d["payload"]
bad = 0
# F1
trg = cards["kv.mechanics.eye.bditelnost_oka"]["parameters"]["growth"]["eyes_gaze"]["trigger"]
if "eye_on_feat_die" not in trg or "success-sign" in trg or "знак успеха" in trg:
    print("F1 FAIL: eyes_gaze.trigger =", trg); bad += 1
# F2
me = cards["kv.mechanics.shadow.bally_teni"]["parameters"]["miserable_effect"]
if me != "eye_on_feat_die = auto_failure":
    print("F2 FAIL: miserable_effect =", me); bad += 1
# F3
wr = cards["kv.mechanics.checks.who_rolls"].get("related", [])
if "kv.mechanics.checks.assistance" not in wr:
    print("F3 FAIL who_rolls ->", wr); bad += 1
wa = cards["kv.mechanics.checks.which_ability"].get("related", [])
need = {"kv.mechanics.traits.navyki","kv.mechanics.traits.boevye_umeniya",
        "kv.mechanics.valour_wisdom.doblest","kv.mechanics.valour_wisdom.mudrost"}
if not need.issubset(set(wa)):
    print("F3 FAIL which_ability ->", wa); bad += 1
print("KV gate-2a re-confirm:", "PASS F1+F2+F3 ok" if bad == 0 else f"FAIL ({bad})")
