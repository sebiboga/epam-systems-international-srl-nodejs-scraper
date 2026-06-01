# Actualizare About repo pe GitHub

Pentru a actualiza secțiunea **About** din dreapta paginii principale a repo-ului pe GitHub (descriere, website, topics):

## CLI (gh)

```bash
# Descriere
gh repo edit <owner>/<repo> \
  --description "web scraper pentru a aduce locurile de munca de la EPAM Romania in platforma peviitor.ro"

# Website
gh repo edit <owner>/<repo> \
  --homepage "https://<owner>.github.io/<repo>/"

# Topics
gh repo edit <owner>/<repo> \
  --add-topic scraper --add-topic epam --add-topic peviitor --add-topic jobs --add-topic romania
```

## Web UI

1. Mergi la `https://github.com/<owner>/<repo>`
2. Click pe ⚙️ **Settings** (tab-ul din dreapta sus)
3. Mergi la secțiunea **General** → **Description**
4. Completează:
   - **Description**: textul de mai sus
   - **Website**: URL-ul GitHub Pages
   - **Topics**: cuvinte cheie separate prin spațiu
5. Click **Save changes**

## Verificare

```bash
gh repo view <owner>/<repo> --json description,homepage,topics
```
