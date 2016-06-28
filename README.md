![weeve logo](https://raw.github.com/dzello/weeve/master/www/images/weeve.png "Weeve logo")

---

### >> weeve has been retired, but the [Keen](https://keen.io) and [Firebase](https://firebase.com) APIs allow you to build more apps just like it :)

---

A weeve is Twitter timeline sharing in a group. See one in action here:

[http://weeve.dzello.com/](http://weeve.dzello.com/)

Read more about weeve on my blog - [weeve - HTML5 Twitter uber-streaming powered by Firebase, Keen IO, and Singly](http://dzello.com/blog/2012/12/24/weeve-html5-twitter-uber-streaming-powered-by-firebase-keenio-and-singly/).

### Background

weeve is a tiny open source experiment made during re-allocated winter break
family time by [@dzello](https://twitter.com/dzello).

weeve includes:

* OAuth authentication - "Sign in with Twitter"
* Real-time sync - Tweets appear instantly across all clients
* Persistence - A history of up to 50 tweets is shown to new users
* Detailed analytics - Charts and graphs that show who's weeving and who's tweeting

Best of all, this app **requires no server**. It's just HTML, JavaScript, and CSS, all done right in the browser.

### The API's

weeve wouldn't be possible without the APIs of a few great companies pushing the limits on
what's possible without running your own server.

weeve is powered by:

* [Firebase](http://firebase.com) provides data storage that's directly accessible to the client. Best of all, clients are notified about changes to data in real-time.
* [Keen IO](http://keen.io)'s analytics APIs collect event data and make charting it a snap.
* [Singly](http://singly.com) provides a uniform interface to social (and other) API's. For weeve, Singly handles the authentication with Twitter.

At this time, weeve has one dependency that does (gasp) require a server (for now):

* A 20-line node.js [twitter streaming proxy](https://github.com/dzello/twitter-stream-proxy) that I wrote. Singly has push support for
  the 'statuses' type, but it's still experimental. Once it's ready, this proxy won't be necessary.

### Usage

*Word of warning: Getting this set up isn't for the faint of heart, but if have a good working knowledge of these components it's not too hard!*

To run your own weeve, you'll need accounts with all of the services mentioned above, and you'll need to do some configuration.

* Create a Firebase. Firebase is in beta, so you might have to wait for an invite. Once you've got an account, create a Firebase and note its URL.
* Create a new Twitter app - [https://dev.twitter.com/apps/new](https://dev.twitter.com/apps/new). Set the callback URL to `http://api.singly.com/auth/twitter/auth`.
* Create a Singly account - [https://singly.com/signup](https://singly.com/signup) and create a Singly app at [https://singly.com/apps](https://singly.com/apps).
* Go to the Singly app's detail page and click the 'Keys' tab. Find Twitter in the list, and paste in the key and secret from your Twitter app.
* Find your Firebase secret by visiting its URL (http://something.firebaseio.com) and click the 'Auth' icon. Then add your Firebase secret to Singly here - [https://singly.com/docs/firebase](https://singly.com/docs/firebase).
* Add the security rules found in `firebase-rules.json` to your Firebase.

Next, you'll need to deploy the twitter streaming proxy I mentioned above. It's a typical node.js app, so publish it to your favorite host. Then record the URL and port. Make sure to set ALLOWED_ORIGINS to where you'll deploy when you configure the proxy.

Clone this repository. Set the following keys at the top of `main.js` to your values:

* weeveUrl (where you are deploying, used for OAuth redirect)
* firebaseUrl
* singlyClientId
* keenProjectId
* keenApiKey
* twitterStreamingProxy

You're ready to deploy. Just push the repository w/ your changes to any static web host, like [Github pages](http://pages.github.com/).

Once you've deployed, share the URL with some friends and start a weeve.

Note: it's easy to work on this locally as well, under Apache or Nginx. Just make sure the above variables reflect your local environment.

### Get updates
Follow me on Twitter at [@dzello](http://twitter.com/dzello) or subscribe to my blog: [http://dzello.com/](http://dzello.com/).

### Future enhancements
* Use the Singly API's to get the tweets and remove the proxy
* Use Firebase rules to constrain the maximum number of concurrent weevers
* Use Firebase to implement an ordered waiting queue for when the weeve is full
* Use Firebase to clean up old tweets automatically (like a capped collection)
* Add more charts and graphs from Keen IO

### Support / Contributing
* Issues :)
* Pull requests :D

### Credits & Acknowledgements

Here's a list of the services and open-source software used in this project:

* Firebase
* Keen IO
* Singly
* Twitter
* cdnjs for hosting JS
* jQuery, jQuery timeago
* Bootstrap
* Backbone.js
* Underscore.js
* twitter-text.js
* sprintf.js
* socket.io
* node.js (for the proxy)
* nTwitter (for the proxy)

