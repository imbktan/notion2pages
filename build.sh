rm ../build/*
rm ../build/images/*
mkdir ../build
mkdir ../build/images
cp -r templates/technical-doc/* ../build
node notion2pages.js ./settings-prod.js