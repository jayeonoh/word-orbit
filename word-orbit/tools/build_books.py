import json, re, random, collections, sys
sys.path.insert(0, '/tmp')
from cbca import CBCA

random.seed(7)
prc = json.load(open('/tmp/prc.json'))

# ---------- 주제 매핑 (PRC themes → 앱 topic) ----------
TOPIC_RULES = [
 ('animals',   r'animal|dog|cat|bird|pet|wombat|koala|kangaroo|possum|penguin|whale|shark|frog|beetle|insect|bug|horse|pony|rabbit|bear|wolf|fox|lion|elephant|owl|duck|chicken|farm|zoo|dinosaur|pigeon|mouse|mice|fish|turtle|crocodile|snake|spider|bee|butterfl|creature|wildlife|bandicoot|echidna|platypus|bilb|dingo|emu|lyrebird|magpie|cockatoo'),
 ('adventure', r'adventure|quest|journey|explor|treasure|pirate|surviv|island|voyage|expedition|escape|action|rescue|bushranger|outback|camping|lost'),
 ('space',     r'outer space|space travel|spaceship|space station|astronaut|rocket|galaxy|alien|solar system|astronom|\bmars\b|moon landing|planets\b|the moon'),
 ('nature',    r'nature|environment|ocean|sea|reef|beach|forest|bush|tree|garden|river|weather|season|climate|sustainab|conservation|endangered|recycl|plant|flower|earth|rain|storm|bushfire|drought|flood|mountain|desert|volcano'),
 ('friendship',r'friend|kindness|belonging|inclusion|acceptance|loneliness|empathy|cooperation|teamwork|community|neighbour|sharing|caring|bully'),
 ('school',    r'school|teacher|classroom|homework|reading|library|learning|first day|exam|spelling'),
 ('family',    r'famil|parent|mother|father|mum|dad|grandparent|grandma|grandpa|nonn|sibling|brother|sister|baby|home|moving|adoption|refugee|migra|immigra|cousin'),
 ('fantasy',   r'fantasy|magic|dragon|fairy|witch|wizard|myth|legend|monster|ghost|unicorn|imagination|superhero|time travel|talking animal|folk tale|fairy tale|spell|curse|quest'),
 ('science',   r'science|scientist|invention|inventor|technolog|robot|engineer|experiment|maths|math|number|code|computer|machine|physics|chemistry|biology|dinosaur|fossil|body|brain|medic|nature study|how things work|energy'),
 ('sports',    r'sport|soccer|football|cricket|netball|swimming|surf|skate|bike|cycling|athlet|olympic|tennis|basketball|running|gymnast|dance|ballet|martial'),
 ('humour',    r'humour|humor|funny|comedy|silly|jokes|laugh|hilarious|slapstick|mischief'),
 ('mystery',   r'mystery|detective|crime|clue|puzzle|secret|spy|investigat|missing|thief|whodunit'),
 ('history',   r'histor|war|anzac|convict|colonial|aboriginal|indigenous|first nations|first peoples|torres strait|ancient|past|dreaming|federation|gold rush|pioneer|medieval|egypt|rome|greek|viking|1[0-9]{3}s'),
]
def topics_for(themes, summary, ftype):
    text = (themes + ' ' + summary).lower()
    out = []
    for t, rx in TOPIC_RULES:
        if re.search(rx, text): out.append(t)
    if not out: out = ['other']
    return out[:4]

BAND = {'Prep - Year 1': 'P-1', 'Years 2-3': '2-3', 'Years 4-5': '4-5', 'Years 6-7': '6-7'}
def norm_title(t):
    t = t.lower()
    t = re.sub(r'\(.*?\)', '', t)
    t = t.split(':')[0]
    return re.sub(r'[^a-z0-9]+', ' ', t).strip()
def first_author(a):
    # "Jerath, Harshita; Burgett, Chloe (illus.)" / "Tarshis, Lauren & Egbert, Corey" → "Harshita Jerath & Corey Egbert"
    a = re.sub(r'\(.*?illus.*?\)', '(illus)', a, flags=re.I)
    parts = re.split(r';|\s+&\s+|\s+and\s+', a)
    names = []
    for p in parts:
        p = p.strip()
        if not p: continue
        if '(illus)' in p and len(parts) > 1: continue
        p = re.sub(r'\(.*?\)', '', p).strip().strip(',')
        if ',' in p:
            last, first = [x.strip() for x in p.split(',', 1)]
            names.append(f'{first} {last}'.strip())
        else: names.append(p)
    return ' & '.join(names[:2])
def short_summary(s):
    s = re.sub(r'\s*\(QDoE\)\s*$', '', s).strip()
    s = re.sub(r'\s+', ' ', s)
    # 첫 1~2문장, 160자 이내
    sents = re.split(r'(?<=[.!?])\s+', s)
    out = ''
    for x in sents:
        if len(out) + len(x) > 170 and out: break
        out = (out + ' ' + x).strip()
        if len(out) >= 90: break
    return out[:200]

# ---------- CBCA 매칭 ----------
cb_by_title = collections.defaultdict(list)
for (y, cat, res, title, author) in CBCA:
    cb_by_title[norm_title(title)].append({'source': 'CBCA', 'year': y, 'category': cat, 'result': res, 'author': author})

books = {}
for r in prc:
    key = norm_title(r['title'])
    if key in books: continue
    ftype = r['type']
    kind = 'NF' if ftype.startswith('NF') or ftype in ('JN-F',) else ('GN' if 'graphic' in ftype.lower() or 'manga' in ftype.lower() else ('JF' if ftype.startswith('JF') or ftype == 'PB' else 'F'))
    b = {
        'title': r['title'].strip(), 'author': first_author(r['author']), 'band': BAND[r['level']], 'kind': kind,
        'pages': r['pages'], 'year': r['year'], 'themes': [t.strip() for t in r['themes'].split(',') if t.strip()][:6],
        'topics': topics_for(r['themes'], r['summary'], ftype), 'summary': short_summary(r['summary']), 'isbn': r['isbn'],
        'sources': [{'source': 'QLD PRC', 'year': r['added'], 'result': 'Booklist'}],
    }
    for a in cb_by_title.get(key, []):
        b['sources'].append({'source': 'CBCA', 'year': a['year'], 'result': a['result'], 'category': a['category']})
    books[key] = b

# CBCA 항목 중 PRC에 없는 책 추가 (초등 범주만)
CAT_BAND = {'Early Childhood': 'P-1', 'Picture Book': '2-3', 'Younger Readers': '4-5', 'Eve Pownall': '4-5'}
added_cb = 0
for (y, cat, res, title, author) in CBCA:
    key = norm_title(title)
    if key in books: continue
    books[key] = {'title': title, 'author': author, 'band': CAT_BAND[cat], 'kind': 'NF' if cat == 'Eve Pownall' else ('JF' if cat != 'Younger Readers' else 'F'),
                  'pages': 0, 'year': y, 'themes': [], 'topics': ['other'], 'summary': '', 'isbn': '',
                  'sources': [{'source': 'CBCA', 'year': y, 'result': res, 'category': cat}]}
    added_cb += 1
print('total candidates', len(books), 'cbca-only added', added_cb)

# ---------- 500권 고르기: 학년대별 균형 + 주제 다양성 + 수상작 우선 ----------
def score(b):
    s = 0
    for src in b['sources']:
        if src['source'] == 'CBCA': s += {'Winner': 6, 'Honour': 5, 'Shortlist': 3}.get(src['result'], 0)
        if src['source'] == 'QLD PRC': s += 2 + (src['year'] - 2019) * 0.25
    if b['kind'] == 'GN': s += 1
    if not b['summary']: s -= 1
    return s + random.random() * 0.5

TARGET = {'P-1': 130, '2-3': 130, '4-5': 125, '6-7': 115}
chosen = []
for band, n in TARGET.items():
    pool = sorted([b for b in books.values() if b['band'] == band], key=score, reverse=True)
    # 주제별 최소 확보 후 나머지 점수순
    picked, seen = [], set()
    topic_quota = collections.Counter()
    max_per_topic = max(8, n // 6)
    for b in pool:
        main = b['topics'][0]
        if topic_quota[main] >= max_per_topic and len(picked) < n * 0.7: continue
        picked.append(b); seen.add(b['title']); topic_quota[main] += 1
        if len(picked) >= n: break
    for b in pool:
        if len(picked) >= n: break
        if b['title'] not in seen: picked.append(b); seen.add(b['title'])
    chosen += picked
    print(band, len(picked), dict(collections.Counter(b['kind'] for b in picked)), dict(topic_quota.most_common(8)))

print('chosen', len(chosen), 'with CBCA', sum(1 for b in chosen if any(s['source']=='CBCA' for s in b['sources'])))
json.dump(chosen, open('/tmp/books500.json', 'w'), ensure_ascii=False)
# data 파일로
with open('/tmp/word-orbit/js/books-data.js', 'w') as f:
    f.write('// books-data.js — 자동 생성 (build_books.py). 출처: 퀸즐랜드 Premier\'s Reading Challenge 도서 목록(prc.median.com.au) + CBCA Book of the Year 2018–2026.\n')
    f.write('// band: P-1 / 2-3 / 4-5 / 6-7 (PRC 학년대). kind: JF(주니어 픽션·그림책) F(픽션) NF(논픽션) GN(그래픽노블)\n')
    f.write('export const BOOKS = ' + json.dumps(chosen, ensure_ascii=False, separators=(',', ':')) + ';\n')
import os; print('bytes', os.path.getsize('/tmp/word-orbit/js/books-data.js'))
