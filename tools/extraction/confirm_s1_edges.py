import json, glob
EXPECT = {
 "predydushchiy_opyt":"hero_creation.previous_experience","reyting_bratstva":"hero_creation.fellowship_rating",
 "vazhnyy_tovarishch":"hero_creation.important_companion","kachestvo_strannik":"traits.otlichitelnye_kachestva",
 "osobennosti_solo":"rewards_virtues.osobennosti","vypolnenie_deystviy":"checks.when_required",
 "rezultaty_na_kosti_ispytaniya":"checks.feat_die_values","osobyy_uspekh_solo":"checks.special_successes",
 "oko_mordora_solo":"eye.oko_mordora","nachalnyy_reyting_bditelnosti":"eye.bditelnost_oka",
 "rost_bditelnosti":"eye.bditelnost_oka","sbros_bditelnosti":"eye.bditelnost_oka",
 "porog_presledovaniya":"eye.presledovanie","sceny_obnaruzheniya":"eye.presledovanie"}
cards={json.load(open(p,encoding="utf-8"))["id"]:json.load(open(p,encoding="utf-8")) for p in glob.glob("content-packs/kv/mechanics/*.json")}
bad=0
for name,tgt in EXPECT.items():
    rel=cards["kv.mechanics.solo."+name]["payload"]["related"]
    if ("kv.mechanics."+tgt) not in rel: print("MISSING",name,"->",tgt,"(got",rel,")"); bad+=1
srz=cards["kv.mechanics.solo.srazhayas_s_soboy"]["payload"]["related"]
if srz!=[]: print("Q2 NOT applied: srazhayas_s_soboy related =",srz); bad+=1
print("S1 edge re-confirm:", "PASS 14/14 + Q2 ok" if bad==0 else f"FAIL ({bad})")
