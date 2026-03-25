import os

path = r'c:\Users\shwet\project101\static\index.html'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_news = -1
end_news = -1
tab_market_end = -1

for i, line in enumerate(lines):
    if '<!-- ── News + Sentiment Section' in line:
        start_news = i
    if '</section>' in line and start_news != -1 and end_news == -1:
        if any('id="news-section"' in l for l in lines[start_news:i]):
            end_news = i
    if '</div><!-- end tab-market -->' in line:
        tab_market_end = i

print(f'Start news: {start_news}')
print(f'End news: {end_news}')
print(f'Tab market end: {tab_market_end}')

if start_news != -1 and end_news != -1 and tab_market_end != -1:
    news_block = lines[start_news:end_news+1]
    
    # We must insert BEFORE we delete if we want to avoid index shifting, 
    # but since tab_market_end < start_news, deleting after doesn't change tab_market_end.
    # Actually wait: start_news is 2775, tab_market_end is 2693.
    # So deleting news_block first is safe for tab_market_end!
    del lines[start_news:end_news+1]
    
    lines.insert(tab_market_end, '\n')
    for line in reversed(news_block):
        lines.insert(tab_market_end, line)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print('Success')
else:
    print('Failed to find indices')
