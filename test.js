'use strict'

var expect = require('chai').expect,  

lambdaToTest = require('./index')

// returns speechResponse when succeed,
// returns speedError when fail
class Context {
  constructor() {
    this.speechResponse = null;
    this.speechError = null;

    this.succeed = (rsp) => {
      this.speechResponse = rsp;
      this.done();
    };

    this.fail = (rsp) => {
      this.speechError = rsp;
      this.done();
    };
  }
}

// if valid response, all these should be true
var validRsp = (ctx, options) => {
     expect(ctx.speechError).to.be.null;
     expect(ctx.speechResponse.version).to.be.equal('1.0');
     expect(ctx.speechResponse.response).not.to.be.undefined;
     expect(ctx.speechResponse.response.outputSpeech).not.to.be.undefined;
     expect(ctx.speechResponse.response.outputSpeech.type).to.be.equal('SSML');
     expect(ctx.speechResponse.response.outputSpeech.ssml).not.to.be.undefined;
     expect(ctx.speechResponse.response.outputSpeech.ssml).to.match(/<speak>.*<\/speak>/);
     if(options.endSession) {
       expect(ctx.speechResponse.response.shouldEndSession).to.be.true;
       expect(ctx.speechResponse.response.reprompt).to.be.undefined;
     } else {
       expect(ctx.speechResponse.response.shouldEndSession).to.be.false;
       console.log('response: ', ctx.speechResponse.response);
       console.log('reprompt: ', ctx.speechResponse.response.reprompt);
       expect(ctx.speechResponse.response.reprompt.outputSpeech).to.be.not.undefined;
       expect(ctx.speechResponse.response.reprompt.outputSpeech.type).to.be.equal('SSML');
       expect(ctx.speechResponse.response.reprompt.outputSpeech.ssml).to.match(/<speak>.*<\/speak>/);
     }

}

var validCard = (ctx, standardCard) => {
  expect(ctx.speechResponse.response.card).not.to.be.undefined;
  expect(ctx.speechResponse.response.card.title).not.to.be.undefined;
  if(standardCard) {
    expect(ctx.speechResponse.response.card.type).to.be.equal('Standard');
    expect(ctx.speechResponse.response.card.text).not.to.be.undefined;
    expect(ctx.speechResponse.response.card.image).not.to.be.undefined;
    expect(ctx.speechResponse.response.card.image.largeImageUrl).to.match(/^https:\/\//);
    expect(ctx.speechResponse.response.card.image.smallImageUrl).to.match(/^https:\/\//);
  }
  else {
    expect(ctx.speechResponse.response.card.type).to.be.equal('Simple');
    expect(ctx.speechResponse.response.card.type).not.to.be.undefined;  
  }
}

// var validCard = (ctx) => {
//   expect(ctx.speechResponse.response.card).not.to.be.undefined;
//   expect(ctx.speechResponse.response.card.type).to.be.equal('Simple');
//   expect(ctx.speechResponse.response.card.title).not.to.be.undefined;
//   expect(ctx.speechResponse.response.card.content).not.to.be.undefined;
// }



var event = {
  session: {
    new: false,
    sessionId: 'session1234',
    attributes: {},
    user: {
      userId: 'usrid123'
    },
    application: {
      applicationId: 'amzn1.echo-sdk-ams.app.1234'
    }
  },
  version: '1.0',
  request: {
    intent: {
      slots: {
        SlotName: {
          name: 'SlotName',
          value: 'slot value'
        }
      },
      name: 'intent name'
    },
    type: 'IntentRequest',
    requestId: 'request5678'
  }
};




describe('All intents', () => {
  // this Context object will hold the response
  var ctx = new Context();


  describe('Test LaunchIntent', () => {

    before((done) => {
      event.request.type = 'LaunchRequest';
      event.request.intent = {};
      event.session.attributes = {};
      ctx.done = done;
      lambdaToTest.handler(event , ctx);
    });


    it('valid response', () => {
      validRsp(ctx,{
        endSession: false,
      });
    });

    // specific to my skills
    it('valid outputSpeech', () => {
      expect(ctx.speechResponse.response.outputSpeech.ssml).to.match(/<speak>Welcome.*<\/speak>/);
    });

    // specific to my skills
    it('valid repromptSpeech', () => {
      expect(ctx.speechResponse.response.reprompt.outputSpeech.ssml).to.match(/<speak>You can say.*<\/speak>/);
    });

  });


  var expResults = {
    'butter salted': {
      endSession: true,
      searchResults: 1
    },
    'orange': {
      endSession: false,
      searchResults: 18   // grep '"orange' food_db.json | wc -l
    },
    'apples raw': {
      endSession: false,
      searchResults: 11    // grep 'apples.* raw' food_db.json | wc -l
    },
    'toy': {
      endSession: true,
      searchResults: 0
    }
  };

  for(var key in expResults) {
    
    describe(`Test GetNutritionInfo ${key}`, () => {
      var options = expResults[key];
      var testFood = key;

      before((done) => {
        event.request.intent = {};
        event.session.attributes = {};
        event.request.type = 'IntentRequest';
        event.request.intent.name = 'GetNutritionInfo';
        event.request.intent.slots = {
          FoodItem: {
            name: 'FoodItem',
            value: testFood
          }
        };
        ctx.done = done;
        lambdaToTest.handler(event , ctx);
      });

      it('valid response', () => {
        validRsp(ctx, options);
      });

      it('valid outputSpeech', () => {
        if(options.searchResults === 0) {
          expect(ctx.speechResponse.response.outputSpeech.ssml).to.match(/Could not find any food item/);
        }
        else {
          var num = ctx.speechResponse.response.outputSpeech.ssml.match(/100 grams/g).length;
          if(options.searchResults > 3) {
            expect(num).to.be.equal(3);
          }
          else {
            expect(num).to.be.equal(options.searchResults);
          }
        }
      });

      if(!options.endSession) {
        it('valid reprompt', () => {
          expect(ctx.speechResponse.response.reprompt.outputSpeech.ssml).to.match(/You can say/);
        });
      }
    });

    if(!expResults[key].endSession) {
      describe(`Test GetNextEventIntent ${key}`, () => {
        var options = expResults[key];
        var testFood = key;

        before((done) => {
          event.request.intent = {};
          event.session.attributes = ctx.speechResponse.sessionAttributes;
          event.request.type = 'IntentRequest';
          event.request.intent.name = 'GetNextEventIntent';
          event.request.intent.slots = {};
          ctx.done = done;
          lambdaToTest.handler(event, ctx);
        });

        it('valid response', () => {
          validRsp(ctx, {endSession: true});
        });

        it('valid outputSpeech', () => {
          expect(ctx.speechResponse.response.outputSpeech.ssml).to.match(new RegExp(`Your search resulted in ${options.searchResults} food items`));
        });

        describe(`Test AMAZON.StopIntent ${key}`, () => {
          var options = expResults[key];
          var testFood = key;

          before((done) => {
            event.request.intent = {};
            event.session.attributes = ctx.speechResponse.sessionAttributes;
            event.request.type = 'IntentRequest';
            event.request.intent.name = 'AMAZON.StopIntent';
            ctx.done = done;
            lambdaToTest.handler(event, ctx);
          })

          it('valid response', () => {
            validRsp(ctx, {endSession: true});
          });

          it('vald outputSpeech', () => {
            expect(ctx.speechResponse.response.outputSpeech.ssml).to.match(/Good Bye./);
          });
        });
      });
    }
  }


});
