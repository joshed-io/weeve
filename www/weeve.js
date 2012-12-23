$(function() {

  // Reader note: Skip to the end of the file to see
  // how execution starts; setup, objecs, and helpers happen first
  var Weeve = {}

  // Use the app's namespace as an event aggregator
  _.extend(Weeve, Backbone.Events)

  // Configuration variables - set according to your environment
  var weeveUrl = "", //where you are deploying, or localhost
    firebaseUrl = "", // A Firebase URL
    singlyApiHost = "https://api.singly.com", // Default, change if hosting your own
    singlyClientId = "", // Client ID of a Singly app
    keenProjectId = "", // Project ID of a Keen project
    keenApiKey = "", // API Key of a Keen project
    twitterStreamProxy = "" // URL of a twitter proxy

  // Other variables used throughout the script
  var currentUser, currentUserAuth,
      firebase = new Firebase(firebaseUrl)
      tweets = new Backbone.Collection(),
      users = new Backbone.Collection()


  // *** Pre-routing setup

  Keen.configure(keenProjectId, keenApiKey)
  Keen.setGlobalProperties(function(collection) {
    // assign a non-identifying user id for progress (funnel) event correlation
    if (collection === "progress") {
      var anonUserId = localStorage.anonUserId;
      if (!anonUserId) {
        anonUserId = localStorage.anonUserId =
          Math.random().toString(36).substring(8)
      }
      return {
        anonUserId: anonUserId
      }
    } else {
      return {}
    }
  })


  // *** All helper functions in alphabetical order

  // Attach child_added and child_removed events for users and tweets
  function bindFirebaseListeners() {
    var usersRef = firebase.child("users")
    usersRef.on("child_added", function(user) {
      users.add(user.val())
    })
    usersRef.on("child_removed", function(user) {
      users.remove(users.get(user.val().id))
    })

    var tweetsRef = firebase.child("tweets")
    tweetsRef.limit(100).on("child_added", function(tweet) {
      tweets.add(tweet.val())
    })
    tweetsRef.on("child_removed", function(tweet) {
      tweets.remove(tweets.get(tweet.val().id))
    })
  }

  // Creates a firebase user and binds a socket to a proxy for their stream
  function createUserAndListenForTweets() {

    // Get a reference to the current user via their screen name
    var userRef = firebase.child("users").child(currentUser.screen_name)
    // User account is deleted if the connection breaks
    userRef.removeOnDisconnect()
    // Add metadata so every client knows when this user joined
    currentUser.weeve = { connected_at: new Date().toISOString() }
    // Oldest users are ordered first
    userRef.setWithPriority(currentUser, new Date().getTime())

    // add a keen progress event
    keen("progress", { step: "user_added_to_firebase" })

    // add another for computing total # of unique users
    // using a different collection so screen name
    // remains unlinked to anonymous correlation id
    // used in progress collection
    keen("users", { step: "signed_in", screen_name: currentUser.screen_name })

    // Bind to the twitter userstream and push tweets to firebase
    var socket = io.connect(twitterStreamProxy)
    socket.on("connect", function() {

      // Send the data the proxy needs to initiate the conversation
      socket.emit("userstream", {
        token: currentUserAuth.token.oauth_token,
        secret: currentUserAuth.token.oauth_token_secret })

      socket.on('tweet', function(tweet) {
        if (tweet.id) { //Sometimes non-tweet messages are sent

          // Add extra data about whose stream this came from
          tweet.weeve = {
            source: {
              screen_name: currentUser.screen_name,
              image_url: currentUser.profile_image_url } }

          // Save the tweet to firebase with the tweet id_str as its key
          // This way, if 2 streams receive the same tweet, we don't duplicate it
          // The first user to write it to Firebase wins, because
          // we've set the Firebase rules to reject updates to tweets
          firebase.child("tweets").child(tweet.id_str).

          // We use the tweet's ascending, numeric id as our priority
          // to keep things in order
            setWithPriority(tweet, tweet.id)

          // Log the tweeter and the streamer to keen
          keen("tweets", {
            source_screen_name: currentUser.screen_name,
            tweet_screen_name: tweet.user.screen_name,
            tweet_id: tweet.id
          })
        }
      })
    })

    // If the user logs out, remove the user and stop listening for tweets
    Weeve.on("auth:logout", function() {
      userRef.remove()
      socket.disconnect()
    })
  }

  // Draw keen charts related to users & steps
  function drawUserMetrics() {
    // How many unique users?
    $("#total-weevers").empty()
    new Keen.Metric("users", {
      analysisType: "count_unique",
      targetProperty: "screen_name"
    }).draw($("#total-weevers")[0], {
      label: "All-time weevers",
      width: "80%"
    })
  }

  // Draw keen charts related to tweets
  function drawTweetMetrics() {
    var chartWidth = 250, chartHeight = 250

    // Who's 'contributed' the most tweets?
    $("#top-weevers").empty()
    new Keen.Metric("tweets", {
      analysisType: "count",
      timeframe: "this_day",
      groupBy: "source_screen_name"
    }).draw($("#top-weevers")[0], {
      width: chartWidth,
      height: chartHeight,
      showLegend: true,
      title: "Top weevers today"
    })

    // Who's the most popular tweeter in the weeve?
    $("#top-tweeters").empty()
    new Keen.Metric("tweets", {
      analysisType: "count",
      timeframe: "this_day",
      groupBy: "tweet_screen_name"
    }).draw($("#top-tweeters")[0], {
      width: chartWidth,
      height: chartHeight,
      showLegend: true,
      title: "Top tweeters today"
    })

    // How many tweets in the last hour?
    $("#tweet-series").empty()
    new Keen.Series("tweets", {
      analysisType: "count",
      timeframe: "last_3_hours",
      interval: "hourly"
    }).draw($("#tweet-series")[0], {
      width: chartWidth,
      height: chartHeight,
      showLegend: false,
      title: "Tweets per hour"
    })

    // How many total tweets have been weeved?
    $("#total-tweets").empty()
    new Keen.Metric("tweets", {
      analysisType: "count",
    }).draw($("#total-tweets")[0], {
      label: "All-time tweets",
      width: "80%"
    })
  }

  // Send data to keen, logging any errors
  function keen(collection, data) {
    Keen.addEvent(collection, data, function() {
    }, function() {
      console.log("couldn't publish to keen")
    })
  }

  // placeholder html
  function loadingHtml(text) {
    return $("<h5>", { "class": "loading" }).html(
      sprintf("Loading %s...", text))
  }

  // Log the firebase user out and clear localStorage,
  // removing any Oauth information
  function logout() {
    firebase.unauth()
    localStorage.clear()
    // tell any component the user is no longer active on the page
    Weeve.trigger("auth:logout")
    // tell components to ask for new authentication again
    Weeve.trigger("auth:get")
  }


  // *** All Backbone objects in alphabetical order

  // Manages login / logout
  var AuthView = Backbone.View.extend({
    initialize: function(options) {
      Weeve.on("auth:ready", _.bind(this.authReady, this))
      Weeve.on("auth:get", _.bind(this.authGet, this))
    },
    events: {
      "click .login": "onLoginClick",
      "click .logout": "onLogoutClick"
    },
    loggedInTemplate: _.template($("#t-auth-logged-in").html()),
    loggedOutTemplate: _.template($("#t-auth-logged-out").html()),
    authGet: function() {
      this.$el.html(this.loggedOutTemplate())
    },
    authReady: function() {
      this.$el.html(this.loggedInTemplate(currentUser))
    },
    onLoginClick: function(event) {
      event.preventDefault()
      var singlyAuthUrl = sprintf(
        "%s/oauth/authenticate?client_id=%s&redirect_uri=%s&service=%s&response_type=token",
        singlyApiHost, singlyClientId, weeveUrl, "twitter")
      document.location.href = singlyAuthUrl
    },
    onLogoutClick: function(event) {
      event.preventDefault()
      logout()
      // only track voluntary logouts, not clean-ups
      keen("progress", {step: "logout"})
    }
  })

  // Manages individual tweets
  var TweetView = Backbone.View.extend({
    className: "tweet-view",
    template: _.template($("#t-tweet").html()),
    render: function() {
      this.$el.html(this.template({tweet: this.model.toJSON(),
                                  currentUser: currentUser || {}}))
      this.$(".timeago").timeago()
      return this
    }
  })

  // Manages adding and removing to the list of tweets
  var TweetListView = Backbone.View.extend({
    className: "tweet-list-view",
    initialize: function() {
      var views = {}
      this.collection.once("add", function() {
        this.$(".loading").remove()
      }, this)
      this.collection.on("add", function(model) {
        views[model.id] = (view = new TweetView({model: model}).render())
        this.$el.prepend(view.$el)
      }, this)
      this.collection.on("remove", function(model) {
        views[model.id].$el.remove()
        delete views[model.id]
      }, this)
    },
    render: function() {
      this.$el.html(loadingHtml("tweets"))
      return this
    }
  })

  // Manages individual users
  var UserView = Backbone.View.extend({
    className: "user-view",
    template: _.template($("#t-user").html()),
    events: {
      "click .toggle": "toggleScreenName"
    },
    render: function() {
      this.$el.html(this.template(this.model.toJSON()))
      this.$(".timeago").timeago()
      this.$(".icon-info-sign").tooltip()
      return this
    },
    toggleScreenName: function(event) {
      event.preventDefault()
      var screenName = this.model.get("screen_name")
      var hide = $(sprintf("#hide-style-%s", screenName))
      if (hide.length > 0) {
        hide.remove()
      } else {
        $(sprintf("<style type='text/css' id='hide-style-%s'>", screenName)).
          html(sprintf("*[data-source-screen-name='%s'] { display: none; }", screenName)).
          appendTo($("head"))
      }
      $(event.currentTarget).toggleClass("deselected")
    }
  })

  // Manages adding and removing to the list of users
  var UserListView = Backbone.View.extend({
    className: "user-list-view",
    initialize: function() {
      var views = {}
      this.collection.once("add", function() {
        this.$(".loading").remove()
      }, this)
      this.collection.on("add", function(model) {
        views[model.id] = (view = new UserView({model: model}).render())
        // start new people at the bottom
        this.$el.append(view.$el)
      }, this)
      this.collection.on("remove", function(model) {
        views[model.id].$el.remove()
        delete views[model.id]
      }, this)
    },
    render: function() {
      this.$el.html(loadingHtml("weevers"))
      return this
    }
  })


  // ** Launch sequence

  // Use a Backbone router as the entry point
  new (Backbone.Router.extend({
    routes: {
      "": "index",
      "firebase=:firebase&access_token=:access_token&account=:account": "firebase"
    },

    index: function() {
      keen("progress", { step: "visit" })

      // Create an auth view, which will listen for auth events
      new AuthView().render().$el.appendTo($("#auth-view"))

      // Create a view to list users on the page
      new UserListView({collection: users}).render().$el.appendTo($("#users-view"))

      // Create a view to list tweets on the page
      new TweetListView({collection: tweets}).render().$el.appendTo($("#tweets-view"))

      // Bind the collections of these views to firebase so they get updates
      bindFirebaseListeners()

      // Draw keen charts
      Keen.onChartsReady(drawUserMetrics)
      Keen.onChartsReady(drawTweetMetrics)

      // Update keen charts every minute
      setInterval(drawUserMetrics, 6e4)
      setInterval(drawTweetMetrics, 6e4)

      // If a user has logged in, use the auth token to authenticate with firebase
      if (localStorage.firebaseAuthToken) {
        firebase.auth(localStorage.firebaseAuthToken, function(success) {
          keen("progress", { step: "firebase_auth" })
          if (success) {
            // Retrieve twitter & auth data via singly
            $.getJSON(sprintf("%s/profiles/twitter", singlyApiHost),
              { auth: true,
                access_token: localStorage.singlyAccessToken }, function(response) {

              // Assign the twitter data, and auth data required by the twitter stream proxy
              currentUser = response.data
              currentUserAuth = response.auth

              // Allow other components to update now that user has signed in
              // and current user data is available
              Weeve.trigger("auth:ready")

              // Check to see if the weeve is full
              var usersRef = firebase.child("users")
              usersRef.once('value', function(users) {
                if (users.numChildren() < 20) {
                  createUserAndListenForTweets()
                } else {
                  keen("progress", { step: "full" })
                  alert("Weeve is full right now. Please refresh your page if you see a spot open up.")
                }
              })

            })
          } else {
            // Something is awry with the keys, logout and start over
            logout()
          }
        })
      } else {
        // Trigger auth:get. compnents respond by setting up the sign up view, etc
        Weeve.trigger("auth:get")
      }
    },

    // Singly passes us back authentication data via this route
    firebase: function(firebase, accessToken, account) {
      // Write tokens into local storage so state can persist
      // across page refreshes
      localStorage.firebaseAuthToken = firebase
      localStorage.singlyAccessToken = accessToken
      localStorage.singlyAccountId = account

      // Track success for funnel & debugging purposes
      keen("progress", { step: "oauth_worked" })

      Backbone.history.navigate("", { trigger: true })
    }
  }))

  // Start execution!
  Backbone.history.start()

  // affix the row of weevers when the user scroll's down
  // for the ultimate 'dashboard' type view
  $(window).scroll(function() {
    var yPosition = $(window).scrollTop();
    // the extra twenty makes it easier to dock when scrolling up
    if (yPosition > $(".header-row").outerHeight() - 20) {
      $(".main-row").css("margin-top", $(".user-row").outerHeight())
      $(".user-row").addClass("fixed")
    } else {
      $(".main-row").css("margin-top", 0)
      $(".user-row").removeClass("fixed")
    }
  })

})
