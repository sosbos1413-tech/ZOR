# طقم توليد باقي الشخصيات (الـ20 وحدة)

هذا الطقم يجعل أداتك تُخرج الشخصيات **بنفس أسلوب صورك الأربع**: أنمي نظيف، تظليل ناعم، خطوط دقيقة، لمعة على الشعر، نصفية (رأس وكتفان).

## الطريقة
1. استخدم **نفس الأداة ونفس النموذج** الذي ولّدت به الصور الأربع، وضع إحداها كـ **مرجع للأسلوب** إن كانت الأداة تدعم ذلك.
2. انسخ **الأسلوب الثابت** ثم سطر الشخصية ثم الخلفية. ولّد 4 نسخ واختر الأفضل.
3. المقاس **1024×1024 مربع**، الوجه في النصف العلوي في المنتصف، **بدون أي نص أو توقيع**.
4. أرسل الصور لي في المحادثة وأنا أقصّها وأركّبها وأريك النتيجة، أو احفظ كل صورة باسم المعرّف (مثل `wave_caller.jpg`) داخل `assets/characters/` ثم شغّل `node tools/scan-images.js`. لقص صورة بنفسك: `python3 tools/prep-image.py مصدر.png wave_caller`.

> لا تكتب في الأوامر أسماء أنميات أو شخصيات أو رسّامين، حتى تبقى الشخصيات أصلية. وتجنّب صفحات التعريف (عدة وجوه في صورة واحدة): اطلب وجهًا واحدًا لكل صورة.

## الأسلوب الثابت (ضعه في بداية كل أمر)
```
clean modern anime illustration, high-quality cel shading with soft gradients, sharp fine linework, glossy hair highlights, detailed expressive eyes with layered highlights, muted cinematic colours, bust portrait (head and shoulders), face centred in the upper half, square 1:1 composition, single character, no text, no watermark, no signature, no border
```

## الأمر السلبي (Negative prompt، إن كانت الأداة تدعمه)
```
text, letters, watermark, signature, logo, frame, border, collage, character sheet, multiple characters, extra fingers, deformed face, cropped head, blurry, low quality
```

## الشخصيات

### رونين الرماد — `ash_ronin` (Ember / مقاتل)
```
young ronin swordsman, calm determined look, black hair in a high ponytail, red headband, dark red haori with ash-grey trim, katana hilt visible over the shoulder, soft gradient background in deep warm orange-red with faint embers
```

### حامي الأتون — `forge_bulwark` (Ember / حارس)
```
broad heavy blacksmith-knight, iron helmet, thick dark beard, stern eyes, dark armour with glowing forge-orange trim, huge hammer behind the shoulder, soft gradient background in deep warm orange-red with faint embers
```

### شبح الشرر — `spark_wraith` (Ember / قاتل)
```
slim agile assassin, spiky orange hair, lower face covered by a dark mask, glowing yellow eyes, black outfit with orange accents, twin daggers, drifting sparks, soft gradient background in deep warm orange-red with faint embers
```

### رامية المحرقة — `pyre_archer` (Ember / قناص)
```
young woman archer, long red ponytail, amber eyes, confident half-smile, leather outfit with gold trim, bow behind the shoulder, ember-coloured feathers, soft gradient background in deep warm orange-red with faint embers
```

### عرّاف البركان — `caldera_seer` (Ember / ساحر)
```
mysterious woman seer, tan skin, long dark-red hair, glowing red eyes, hooded robe with glowing lava cracks, small floating orb of lava, calm expression, soft gradient background in deep warm orange-red with faint embers
```

### مستدعية الموج — `wave_caller` (Tide / دعم)
```
gentle young priestess, blue twin-tails, light cyan eyes, soft smile, white-and-blue outfit, seashell earrings, staff with a crescent moon on top, soft gradient background in deep blue-teal with faint moonlight ripples
```

### حارس المرجان — `coral_sentinel` (Tide / حارس)
```
calm guardian knight, coral-pink helmet with fin crest, deep teal armour with pink trim, warm amber eyes, large round shield at the shoulder, soft gradient background in deep blue-teal with faint moonlight ripples
```

### سيّاف القمر — `lunar_blade` (Tide / مقاتل)
```
pale elegant swordsman, silver-white hair, pale blue eyes, quiet confident look, dark navy outfit, small crescent mark on the forehead, curved sword, soft gradient background in deep blue-teal with faint moonlight ripples
```

### ساحرة الضباب — `mist_witch` (Tide / ساحر)
```
young witch, ice-blue bob hair, pale cyan eyes, playful smile, dark-blue pointed witch hat with a light-blue band, floating orb of mist, soft gradient background in deep blue-teal with faint moonlight ripples
```

### كاهن المدّ العالي — `tide_priest` (Tide / دعم)
```
dignified elderly priest, dark skin, white hair and full white beard, glowing cyan eyes, golden halo above the head, white and cyan robes, staff topped with a golden cross, soft gradient background in deep blue-teal with faint moonlight ripples
```

### كلب الشبكة — `grid_hound` (Neon / قاتل)
```
street hacker assassin, spiky magenta hair, cat-ear headphones, lower face covered by a black mask, glowing cyan eyes, dark hoodie with magenta accents, soft gradient background in dark purple and magenta with a faint neon grid
```

### قناصة البكسل — `pixel_sniper` (Neon / قناص)
```
cool young woman sniper, mint-teal bob hair, magenta visor covering the eyes, black tech suit with mint lines, neon bow-rifle behind the shoulder, soft gradient background in dark purple and magenta with a faint neon grid
```

### وحدة الجدار الناري — `firewall_unit` (Neon / حارس)
```
armoured android guardian, purple helmet with a small antenna, red visor, grey metallic face plates, violet plated armour, glowing shield at the shoulder, soft gradient background in dark purple and magenta with a faint neon grid
```

### المبرمجة الطيفية — `spectral_coder` (Neon / دعم)
```
pale gentle girl, long lavender hair, round glasses, big headphones, oversized hoodie with glowing cyan circuit lines, floating holographic orb, soft gradient background in dark purple and magenta with a faint neon grid
```

### رونين الكروم — `chrome_ronin` (Neon / مقاتل)
```
chrome-skinned cyborg samurai, tall white mohawk, glowing magenta eyes, scar across the cheek, black armour with silver trim, katana at the shoulder, soft gradient background in dark purple and magenta with a faint neon grid
```

### حارس الطحلب — `moss_warden` (Grove / حارس)
```
stoic forest guardian, dark brown skin, moss-green hooded cloak, crown of leaves, glowing pale-green eyes, bark armour, round wooden shield, soft gradient background in deep green with faint out-of-focus leaves
```

### ثعلب الأشواك — `thorn_fox` (Grove / مقاتل)
```
mischievous youth, messy orange hair, orange fox ears, green markings on the cheeks, amber eyes, cheeky grin, leaf-green outfit, twin daggers, soft gradient background in deep green with faint out-of-focus leaves
```

### عين الصفصاف — `willow_eye` (Grove / قناص)
```
elf-like archer woman, long green hair with leaf ornaments, light yellow-green eyes, calm focused look, green scarf, longbow behind the shoulder, soft gradient background in deep green with faint out-of-focus leaves
```

### شامان الجذور — `root_shaman` (Grove / ساحر)
```
serene shaman woman, long dark hair, branching antlers, glowing green eyes, green face markings, brown-and-green robes, staff of twisted roots, soft gradient background in deep green with faint out-of-focus leaves
```

### المتربّص البري — `wild_stalker` (Grove / قاتل)
```
feral hunter, wild dark-green hair, glowing yellow eyes, half mask over the mouth, scar on the cheek, dark forest outfit, claw blades, soft gradient background in deep green with faint out-of-focus leaves
```
