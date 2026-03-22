---
description: Admin Portal'i Cloud Run'a deploy et (lokma.shop)
---

# Admin Portal Deploy

> **UYARI:** `firebase deploy --only hosting:lokma` KULLANMA. Firebase Framework Support, Next.js 16 ile 409 Cloud Run revision conflict bug'i yaratir.

## Adimlar

// turbo-all

1. Projeye git:
```bash
cd /Users/metinoz/Developer/LOKMA/admin_portal
```

2. Cloud Run'a deploy et:
```bash
gcloud run deploy ssrlokma --source . --region europe-west1 --project aylar-a45af --allow-unauthenticated --memory 1Gi --cpu 1 --port 3000 --clear-base-image
```

3. Deploy tamamlaninca, siteyi dogrula:
```bash
curl -s -o /dev/null -w "%{http_code}" https://lokma.shop/de
```

## Notlar
- Build suresi ~5-8 dakika (Cloud Build + Docker image)
- Dockerfile ve `output: "standalone"` zaten ayarli
- Environment variable'lar Cloud Run service uzerinde tanimli
