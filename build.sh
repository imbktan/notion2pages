rm -r build
mkdir build
mkdir build/images
cp -r templates/technical-doc/* ./build
node make-doc.js ./settings-prod.js