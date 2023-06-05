# Notion2Pages
Build technical documentation from Notion pages

Sample: https://support.craftmypdf.com

## How to build 
- Step 1: Clone the repo
  ```
  https://github.com/imbktan/notion2pages
  ```
- Step 2: Create a file `settings-prod.js` based on `settings.js`
- Step 3: Update the `apiKey` and `pageID` in `settings-prod.js`
- Step 4: Run build.sh
- Step 5: Copy all the content in the build folder to your webserver, cloudflare pages or AWS S3
  

## Deployment Options
- Cloudflare pages
- AWS S3