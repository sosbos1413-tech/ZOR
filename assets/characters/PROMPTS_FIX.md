# بروميتات إصلاح الصور المتشابهة (6) + الحصريات الناقصة (4)

شفت كل صور الكروت جنب بعض، وفيه **نفس الوجه بلون ثاني** في عدة كروت (توليد الصور كرر نفس الشخصية). نبقي الأول ونبدّل الثاني بصورة **مختلفة تمامًا** (عمر، جنس، قصة شعر، لبس، شكل الجسم).

| يبقى | يتبدّل | وين التشابه |
|---|---|---|
| شينغو `momo` (جمر) | **هاروتو `haruka`** (مدّ · ساحر) | نفس الشاب بشعر وردي ونظارة، لون ثاني |
| تسوباكي `tsubaki` (جمر) | **أوتوهيمي `otohime`** (مدّ · دعم · ليجندري) | نفس العجوز بشعر رمادي مربوط |
| يوتا `yuta` (جمر) | **كوتا `kota`** (مدّ · قناص) | نفس الولد ببني شعر وابتسامة |
| غودو `godo` (جمر) | **دايكاي `daikai`** (مدّ · حارس) | نفس الرجل الأصلع بشنب |
| ميتسوكي `mitsuki` (نيون) | **شيوري `shiori`** (مدّ · ساحر) | نفس الولد/البنت الأشقر بكرة بين يديه |
| تايجو `taiju` (غابة) | **جينزو `genzo`** (غابة · حارس) | وجهين شجر متقاربين |

## الأسلوب الثابت (الصقه قبل كل سطر)
```
clean modern anime illustration, high-quality cel shading with soft gradients, sharp fine linework, glossy hair highlights, detailed expressive eyes with layered highlights, muted cinematic colours, bust portrait (head and shoulders), face centred in the upper half, square 1:1 composition, single character, no text, no watermark, no signature, no border
```
## الأمر السلبي
```
text, watermark, signature, border, frame, multiple people, extra fingers, deformed face, blurry, low quality, same face as other characters
```

### هاروتو — `haruka` (ساحر · المدّ)
```
tidal scholar-mage of a moonlit archipelago, tall lean young man with long dark teal hair in a loose braid, tanned skin with silver wave-pattern tattoos on his cheek, a hooded sea-green and white coat with coral buttons, thoughtful half-lidded eyes, three small floating water orbs circling his raised hand, background deep teal-blue with soft moonlight ripples.
```
### أوتوهيمي — `otohime` (دعم · المدّ · ليجندري)
```
legendary sea princess of a tidal world, graceful young woman with very long wavy aqua-and-pearl hair, a delicate crown of living coral and pearls, flowing translucent white and turquoise robes like sea foam, kind glowing aquamarine eyes, a gentle smile, light rays and drifting bubbles around her, regal and luminous, background shimmering blue-green deep sea.
```
### كوتا — `kota` (قناص · المدّ)
```
young tide harpooner, energetic teenage boy with short messy white-blond hair and a sunburnt face, a sleeveless dark-blue sailor vest with rope straps, a compact water-powered crossbow, confident grin showing a missing tooth, spray of seawater behind him, background bright teal with white foam.
```
### دايكاي — `daikai` (حارس · المدّ · ملحمي)
```
epic sea guardian, huge broad-shouldered older man with a long braided white beard, a heavy conch-shell helmet with a lowered visor and pearl-studded shell plate armour, scars across one cheek, calm stern eyes, a massive tower shield decorated with a carved whale, background deep ocean blue with distant shipwreck silhouettes.
```
### شيوري — `shiori` (ساحر · المدّ)
```
shy young tide apprentice, teenage girl with straight silver hair cut in a neat bob with long side locks, large lavender eyes, a pale blue oversized scholar's robe with fish-scale embroidery, holding a small wooden wand with a glowing pearl, a few bubbles floating near her, gentle nervous smile, background soft blue-teal gradient.
```
### جينزو — `genzo` (حارس · الغابة)
```
ancient stone-and-moss golem guardian of a living forest, rough grey boulder body with deep cracks glowing with soft green runes, a crown of thick ferns and white mushrooms growing on its head, wide calm glowing amber eyes, small flowers on its shoulders, heavy and gentle, background dark green forest with sun shafts.
```

## الحصريات الناقصة (4): ما عندها صور للحين
البروميتات الأربعة (هينوتوري `hinotori`، ميكازوكي `mikazuki`، كاميناري `kaminari`، كوداما `kodama`) في `PROMPTS_EVENT.md`.

## بعد ما تجهز الصور
```
python3 tools/prep-image.py <الملف> <id>      # يقصّها مربعة ويحفظها في assets/characters/
node tools/scan-images.js                      # يسجّلها في اللعبة
python3 tools/lookalikes.py                    # يتأكد ما عاد فيه وجهين متشابهين
```
أو أرسل لي الصور وأسوّي الباقي.
