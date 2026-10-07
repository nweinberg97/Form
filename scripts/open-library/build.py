"""
Builds FORM's open exercise library from free-exercise-db
(https://github.com/yuhonas/free-exercise-db, public domain / Unlicense).

Usage: python3 scripts/open-library/build.py <path-to-free-exercise-db-checkout>
Writes src/content/open-library.json and public/library/<id>/{0,1}.webp
(requires the `sharp` CLI-free path: images are converted with Pillow if present, else copied as JPEG).
"""
import json, os, re, shutil, subprocess, sys

src = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
allow = json.load(open(os.path.join(os.path.dirname(__file__), "allowlist.json")))
data = {x["name"]: x for x in json.load(open(os.path.join(src, "dist/exercises.json")))}

AREA = {
    "neck": ["neck"], "traps": ["neck", "upper-back"], "shoulders": ["shoulder"], "chest": ["shoulder"],
    "middle back": ["upper-back"], "lats": ["upper-back"], "lower back": ["lower-back"], "abdominals": ["core"],
    "glutes": ["hip"], "abductors": ["hip"], "adductors": ["hip"], "hamstrings": ["hip", "knee"],
    "quadriceps": ["knee"], "calves": ["ankle"], "biceps": ["arm"], "triceps": ["arm"], "forearms": ["arm"],
}
EQUIP = {"body only": "none", "bands": "band", "exercise ball": "ball", "foam roll": "foam-roller", "other": "none", None: "none"}

def slugify(name):
    return "open-" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")

def join(words):
    words = list(dict.fromkeys(words))
    return words[0] if len(words) == 1 else ", ".join(words[:-1]) + " and " + words[-1]

out = []
img_dir = os.path.join(root, "public", "library")
shutil.rmtree(img_dir, ignore_errors=True)
for name in allow:
    x = data.get(name)
    if not x:
        print("missing:", name); continue
    slug = slugify(name)
    muscles = x["primaryMuscles"]
    areas = sorted({a for m in muscles for a in AREA.get(m, [])}) or ["core"]
    stretch = x["category"] == "stretching"
    mobility = "Circles" in name or name in ("Torso Rotation", "Dynamic Back Stretch", "Dynamic Chest Stretch")
    category = "mobility" if mobility else ("stretch" if stretch else "strength")
    side_words = ("Side", "One", "Single", "Knee Across", "On The Knee")
    images = []
    for i, rel in enumerate(x["images"][:2]):
        dst_rel = f"library/{slug}/{i}.webp"
        dst = os.path.join(root, "public", dst_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        subprocess.run(["node", "-e", f"""
const s=require('/home/claude/.npm-global/lib/node_modules/sharp');
s({json.dumps(os.path.join(src, 'exercises', rel))}).resize({{width:640,withoutEnlargement:true}}).webp({{quality:72}}).toFile({json.dumps(dst)}).catch(e=>{{console.error(e);process.exit(1)}});
"""], check=True)
        images.append(dst_rel)
    target = join(muscles)
    out.append({
        "slug": slug,
        "name": name.replace(" - With Bands", " with Band"),
        "summary": (f"A stretch for the {target}." if category == "stretch" else
                    f"Gentle mobility for the {target}." if category == "mobility" else
                    f"Strength work for the {target}."),
        "bodyAreas": areas,
        "movementPatterns": [x.get("force") or "static", x.get("mechanic") or "isolation"],
        "categories": [category],
        "equipment": [EQUIP.get(x.get("equipment"), "none")],
        "difficulty": 1 if x["level"] == "beginner" else 2,
        "lateralitySupported": any(w in name for w in side_words),
        "defaultDosage": {"sets": 2, "durationSec": 30} if category == "stretch" else {"sets": 2, "reps": 10},
        "secondsPerSet": 45,
        "instructions": [s.strip() for s in x["instructions"] if s.strip()][:6],
        "formCues": ["Breathe slowly and stay relaxed", "Ease off if anything feels sharp"] if category != "strength"
                     else ["Move slowly and with control", "Stop a rep or two before your form fades"],
        "feel": "A steady, comfortable stretch — never sharp pain." if category == "stretch"
                else "Easy, smooth movement through a comfortable range." if category == "mobility"
                else "The working muscles should feel challenged, not painful.",
        "commonMistakes": ["Rushing the movement", "Holding your breath"],
        "safetyNotes": "Stop if you feel sharp or increasing pain, numbness or tingling, and check with your physio before continuing.",
        "tags": sorted(set(muscles + [category, "open library"])),
        "images": images,
        "sourceId": x["id"],
    })

json.dump(out, open(os.path.join(root, "src/content/open-library.json"), "w"), indent=1, ensure_ascii=False)
print(len(out), "exercises written")
