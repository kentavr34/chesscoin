import os
import re

i18n_path = 'c:/Users/SAM/Desktop/chesscoin/bot/i18n.py'

with open(i18n_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace hardcoded 50% in features
text = text.replace("50% с их побед", "до 50% с их побед (зависит от звания)")
text = text.replace("50% of their wins", "up to 50% of their wins (based on rank)")
text = text.replace("50% з перемог", "до 50% з перемог (залежить від звання)")

# Replace hardcoded 50% in referral_info_body
text = text.replace("🥇 <b>50%</b> от побед друга", "🥇 От <b>15% до 50%</b> от побед друга (зависит от звания)")
text = text.replace("🥇 <b>50%</b> from each friend's win", "🥇 From <b>15% to 50%</b> of friend's wins (based on Military Rank)")
text = text.replace("🥇 <b>50%</b> від перемог друга", "🥇 Від <b>15% до 50%</b> від перемог друга (залежить від звання)")

# Invite text
text = text.replace("и <b>50%</b> от каждой его победы", "и <b>от 15% до 50%</b> от каждой его победы")
text = text.replace("and <b>50%</b> from every win", "and <b>up to 50%</b> from every win depending on your rank")

with open(i18n_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("i18n texts updated successfully.")
