require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');
const fs = require('fs');

const PORT = process.env.PORT || 8000;

// creating server
const app = express();
app.listen(PORT, ()=>{
  console.log(` Bot server running on ${PORT}`)
});
//Telegram bot token
const token = process.env.TELEGRAM_BOT_TOKEN;

//OpenWeatherMap API key
const appID = process.env.OPENWEATHERMAP_API_KEY;

//Openai api token key
const openAiToken = process.env.OPEN_AI_TOKEN;

//creating instance of open ai
const openai = new OpenAI({
    apiKey: openAiToken
  });

//Created instance of TelegramBot
const bot = new TelegramBot(token, {polling: true});
const storage = {}

let prompt = "";

//OpenWeatherMap endpoint for getting weather by city name
const weatherEndpoint = (city) => (
  `http://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&&appid=${appID}`
);

//URL that provides icon according to the weather
const weatherIcon = (icon) => `http://openweathermap.org/img/w/${icon}.png?size=25x25`;

//Template for weather response
const weatherHtmlTemplate = (name, main, weather, wind, clouds) => (
  `The weather in <b>${name}</b>:
<b>${weather.main}</b> - ${weather.description}
Temperature: <b>${main.temp} °C</b>
Pressure: <b>${main.pressure} hPa</b>
Humidity: <b>${main.humidity} %</b>
Wind: <b>${wind.speed} meter/sec</b>
Clouds: <b>${clouds.all} %</b>
`
);


// Function that gets the weather information by the city name
const getWeather = async (chatId, city) => {
  const endpoint = weatherEndpoint(city);
try{

  const resp = await axios.get(endpoint);
    const {
      name,
      main,
      weather,
      wind,
      clouds
    } = resp.data;

    const temp = main.temp;
    const pressure = main.pressure;
    const humidity = main.humidity;

    bot.sendMessage(
      chatId,
      weatherHtmlTemplate(name, main, weather[0], wind, clouds), {
        parse_mode: "HTML"
      }
    );
    bot.sendPhoto(chatId, weatherIcon(weather[0].icon));

    prompt = "The following is weather information recieved from an app please give suggestions: Temprature is " + temp + "pressure is" + pressure + " and humidity is " + humidity;
    funStart(chatId, prompt);

  }catch (error) {
    console.log("error", error);
    bot.sendMessage(
      chatId,
      `Ooops...city not found or weather information not available for <b>${city}</b>`, {
        parse_mode: "HTML"
      }
    );
  };
}

// Handling /start event
bot.onText(/start/, (msg) => {
  const opts = {
    reply_markup: JSON.stringify({
      keyboard: [
        [{text: 'Send Location', request_location: true}],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    }),
  };
  bot.sendMessage(msg.chat.id, `Welcome ${msg.chat.first_name} make sure your location is on for Telegram press Send Location button`,
  opts);
});

// Request location from the user
bot.on('location', (msg) => {
  // console.log(msg.location.latitude);
  // console.log(msg.location.longitude);
  const latitude = msg.location.latitude;
  const longitude = msg.location.longitude;
  const url = `https://geocode.maps.co/reverse?lat=${latitude}&lon=${longitude}`;
  //console.log(url); test
  axios.get(url)
  .then(response => {
    // Extract the desired data from the response
    const data = response.data;
    const address = data.address

    // Do something with the extracted data
    bot.sendMessage(msg.chat.id,
    `You are currently Located at:
    Country: <b>${address.country}</b>
    Region: <b>${address.state}</b>
    City: <b>${address.state_district}</b>
    Sub City: <b>${address.county}</b>
    Street: <b>${address.suburb}</b>`,
       { parse_mode: "HTML" }
    )

    getWeather(msg.chat.id, address.state_district);

    //console.log(res);
   
  })
  .catch(error => {
    console.error('Error:', error);
  });
})

// function of openai that gives suggestion based on weather information
const funStart = async function(chatId, prompt){
  try {
    
    const chatCompletion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-3.5-turbo',
  });
        const res = await chatCompletion.choices[0].message.content;
        bot.sendMessage(chatId, res);
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        console.error(error.status);  // e.g. 401
        console.error(error.message); // e.g. The authentication token you passed was invalid...
        console.error(error.code);  // e.g. 'invalid_api_key'
        console.error(error.type);  // e.g. 'invalid_request_error'
      } else {
        // Non-API error
        console.log(error);
      }
    }
  }
  