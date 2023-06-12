export output=../build 
echo $output
rm $output/images/*
rmdir $output/images/*
rm $output/*
mkdir $output
mkdir $output/images
cp -r templates/technical-doc/* $output
node notion2pages.js ./settings-prod.js