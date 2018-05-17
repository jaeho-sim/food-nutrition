// This is template files for developing Alexa skills

'use strict';

var winston = require('winston');

var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({ prettyPrint: true, timestamp: true, json: false, stderrLevels:['error']})
    ]
  });

var intentHandlers = {};

if(process.env.NODE_DEBUG_EN) {
  logger.level = 'debug';
}


exports.handler = (event, context, callback) => {
    try {

        logger.info('event.session.application.applicationId=' + event.session.application.applicationId);

        if (APP_ID !== '' && event.session.application.applicationId !== APP_ID) {
            context.fail('Invalid Application ID');
         }
      
        if (!event.session.attributes) {
            event.session.attributes = {};
        }

        logger.debug('Incoming request:\n', JSON.stringify(event,null,2));

        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }


        if (event.request.type === 'LaunchRequest') {
            onLaunch(event.request, event.session, new Response(context,event.session));
        } else if (event.request.type === 'IntentRequest') {
            var response =  new Response(context,event.session);
            if (event.request.intent.name in intentHandlers) {
              intentHandlers[event.request.intent.name](event.request, event.session, response,getSlots(event.request));
            } else {
              response.speechText = 'Unknown intent';
              response.shouldEndSession = true;
              response.done();
            }
        } else if (event.request.type === 'SessionEndedRequest') {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail('Exception: ' + getError(e));
    }
};

var getSlots = (req) => {
  var slots = {}
  for(var key in req.intent.slots) {
    slots[key] = req.intent.slots[key].value;
  }
  return slots;
}

var Response = class {
  constructor(context, session) {
    this.speechText = '';
    this.shouldEndSession = true;
    this.ssmlEn = true;
    this._context = context;
    this._session = session;

    this.done = (options) => {

      if(options && options.speechText) {
        this.speechText = options.speechText;
      }

      if(options && options.repromptText) {
        this.repromptText = options.repromptText;
      }

      if(options && options.ssmlEn) {
        this.ssmlEn = options.ssmlEn;
      }

      if(options && options.shouldEndSession) {
        this.shouldEndSession = options.shouldEndSession;
      }

      this._context.succeed(buildAlexaResponse(this));
    }

    this.fail = (msg) => {
      logger.error(msg);
      this._context.fail(msg);
    }
  }
};

var createSpeechObject = (text,ssmlEn) => {
  if(ssmlEn) {
    return {
      type: 'SSML',
      ssml: '<speak>'+text+'</speak>'
    }
  } else {
    return {
      type: 'PlainText',
      text: text
    }
  }
}

var buildAlexaResponse = (response) => {
  var alexaResponse = {
    version: '1.0',
    response: {
      outputSpeech: createSpeechObject(response.speechText,response.ssmlEn),
      shouldEndSession: response.shouldEndSession
    }
  };

  if(response.repromptText) {
    alexaResponse.response.reprompt = {
      outputSpeech: createSpeechObject(response.repromptText,response.ssmlEn)
    };
  }

  if(response.cardTitle) {
    alexaResponse.response.card = {
      type: 'Simple',
      title: response.cardTitle
    };

    if(response.imageUrl) {
      alexaResponse.response.card.type = 'Standard';
      alexaResponse.response.card.text = response.cardContent;
      alexaResponse.response.card.image = {
        smallImageUrl: response.imageUrl,
        largeImageUrl: response.imageUrl
      };
    } else {
      alexaResponse.response.card.content = response.cardContent;
    }
  }

  if (!response.shouldEndSession && response._session && response._session.attributes) {
    alexaResponse.sessionAttributes = response._session.attributes;
  }
  logger.debug('Final response:\n', JSON.stringify(alexaResponse,null,2),'\n\n');
  return alexaResponse;
}

var getError = (err) => {
  var msg='';
  if (typeof err === 'object') {
    if (err.message) {
      msg = ': Message : ' + err.message;
    }
    if (err.stack) {
      msg += '\nStacktrace:';
      msg += '\n====================\n';
      msg += err.stack;
    }
  } else {
    msg = err;
    msg += ' - This error is not object';
  }
  return msg;
}


//--------------------------------------------- Skill specific logic starts here ----------------------------------------- 

//Add your skill application ID from amazon devloper portal
var APP_ID = '';

var onSessionStarted = (sessionStartedRequest, session) => {
    logger.debug('onSessionStarted requestId=' + sessionStartedRequest.requestId + ', sessionId=' + session.sessionId);
    // add any session init logic here
    
}

var onSessionEnded = (sessionEndedRequest, session) => {
  logger.debug('onSessionEnded requestId=' + sessionEndedRequest.requestId + ', sessionId=' + session.sessionId);
  // Add any cleanup logic here
  
}

var onLaunch = (launchRequest, session, response) => {
  logger.debug('onLaunch requestId=' + launchRequest.requestId + ', sessionId=' + session.sessionId);

  //response.speechText = 'Welcome msg';
  //response.repromptText = 'Reprompt msg';
  response.shouldEndSession = false;
  response.done();
}

const MAX_RESPONSES = 3;
const MAX_FOOD_ITEMS = 10;

intentHandlers['GetNutritionInfo'] = (request,session,response,slots) => {
  var foodDb = require('./food_db.json');
  var results = searchFood(foodDb, slots.FoodItem);

  // no result
  if(results.length == 0) {
    response.speechText = `Could not find any food item for ${slots.FoodItem}. Please try different food item. `;
    response.shouldEndSession = true;
    response.done();
  }
  else {
    results.slice(0, MAX_RESPONSES).forEach(item => response.speechText += `100 grams of ${item[0]} contains ${item[1]} calories. `);

    // telling user that we have more results
    if(results.length > MAX_RESPONSES) {
      response.speechText += `There are more food matched your search. You can say more information for more information. Or say stop to stop the skill. `;
      response.repromptText = `You can say more information or stop. `;
      // save the results number
      session.attributes.resultLength = results.length;
      session.attributes.results = results.slice(MAX_RESPONSES, MAX_FOOD_ITEMS);
      response.shouldEndSession = false;
      response.done();
    }
    else {
      response.shouldEndSession = true;
      response.done();
    }
  }
}

intentHandlers['GetNextEventIntent'] = (request,session,response,slots) => {
  response.speechText = `Your search resulted in ${session.attributes.resultLength} food items. Here are the few food items from search. Please add more keywords from this list for better results. `;
  session.attributes.results.forEach(item => response.speechText += `${item[0]}. `);
  response.shouldEndSession = true;
  response.done();
}

intentHandlers['AMAZON.StopIntent'] = (request,session,response,slots) => {
  response.speechText = `Good Bye. `;
  response.shouldEndSession = true;
  response.done();
}


// search algorithm
var searchFood = (fDb, foodName) => {
  foodName = foodName.toLowerCase().replace(/,/g, '');
  var foodWords = foodName.split(/\s+/);
  var regExps = [];
  var searchResult = [];

  foodWords.forEach((sWord) => {
    // remove plural
    regExps.push(new RegExp(`^${sWord}(es|s)?\\b`));
    regExps.push(new RegExp(`^${sWord}`));
  });

  fDb.forEach((item) => {
    var match = 1;
    var fullName = item[0];
    var cmpWeight = 0;

    foodWords.forEach((sWord) => {
      if(!fullName.match(sWord)) {
        match = 0;
      }
    });

    if(match == 0) {
      return;
    }

    regExps.forEach((rExp) => {
      if(fullName.match(rExp)) {
        cmpWeight += 10;
      }
    });

    if(fullName.split(/\s+/).length == foodWords.length) {
      cmpWeight += 10;
    }

    searchResult.push([item, cmpWeight]);
  });

  var finalResult = searchResult.filter(x => x[1] >= 10);
  if(finalResult.length == 0) {
    finalResult = searchResult;
  }
  else {
    finalResult.sort((a,b) => b[1] - a[1]);
  }

  finalResult = finalResult.map((x) => x[0]);

  return finalResult;
}


/** For each intent write a intentHandlers
Example:
intentHandlers['HelloIntent'] = (request,session,response,slots) => {
  //Intent logic
  
}
**/
