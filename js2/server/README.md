# How to run it

first install the modules

npm i

then

node server.ts

lastly you can test it with

curl -X POST http://localhost:1234/chat      -H "Content-Type: application/json"      -
d '{
           "source": "8qYPuLNmnVgmLfR7ZGon7jfnSmNCr2MUHA9sUnfJseU3"
         }'

That should send 1 token 
