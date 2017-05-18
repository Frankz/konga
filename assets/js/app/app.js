/**
 * Frontend application definition.
 *
 * This is the main file for the 'Frontend' application.
 */
(function() {
  'use strict';

  // Create frontend module and specify dependencies for that
  angular.module('frontend', [
      'angular-spinkit',
      //'frontend-templates',
      'frontend.core',
      'frontend.dashboard',
      'frontend.settings',
      'frontend.upstreams',
      'frontend.info',
      'frontend.plugins',
      'frontend.certificates',
      'frontend.users',
      'frontend.consumers',
      'frontend.apis',
      'frontend.connections',
      'frontend.snapshots',

  ]);


  /**
   * Configuration for frontend application, this contains following main sections:
   *
   *  1) Configure $httpProvider and $sailsSocketProvider
   *  2) Set necessary HTTP and Socket interceptor(s)
   *  3) Turn on HTML5 mode on application routes
   *  4) Set up application routes
   */
  angular.module('frontend')
      .config(function($logProvider){
          $logProvider.debugEnabled(window.enableLogs);
      })

      // Provider to disable UI routers template caching
      .config(['$provide', function($provide){
          // Set a suffix outside the decorator function
          var cacheBuster = Date.now().toString();

          function templateFactoryDecorator($delegate) {
              var fromUrl = angular.bind($delegate, $delegate.fromUrl);
              $delegate.fromUrl = function (url, params) {
                  if (url !== null && angular.isDefined(url) && angular.isString(url)) {
                      url += (url.indexOf("?") === -1 ? "?" : "&");
                      url += "v=" + cacheBuster;
                  }

                  return fromUrl(url, params);
              };

              return $delegate;
          }

          $provide.decorator('$templateFactory', ['$delegate', templateFactoryDecorator]);
      }])
      .config(['$provide',function($provide) {
          $provide.decorator('$state', function($delegate) {
              var originalTransitionTo = $delegate.transitionTo;
              $delegate.transitionTo = function(to, toParams, options) {
                  return originalTransitionTo(to, toParams, angular.extend({
                      reload: true
                  }, options));
              };
              return $delegate;
          });
      }])
    .config([
      '$stateProvider', '$locationProvider', '$urlRouterProvider', '$httpProvider', '$sailsSocketProvider',
       'cfpLoadingBarProvider',
      'toastrConfig',
      'AccessLevels',
      function config(
        $stateProvider, $locationProvider, $urlRouterProvider, $httpProvider, $sailsSocketProvider,
         cfpLoadingBarProvider,
        toastrConfig,
        AccessLevels
      ) {
        $httpProvider.defaults.useXDomain = true;

        delete $httpProvider.defaults.headers.common['X-Requested-With'];

        // Add interceptors for $httpProvider and $sailsSocketProvider
        $httpProvider.interceptors.push('AuthInterceptor');
        $httpProvider.interceptors.push('ErrorInterceptor');
        $httpProvider.interceptors.push('timeoutHttpIntercept');
        //$httpProvider.interceptors.push('CsrfInterceptor');

        //$httpProvider.interceptors.push('TemplateCacheInterceptor');
        $httpProvider.interceptors.push('KongaInterceptor');

        // Iterate $httpProvider interceptors and add those to $sailsSocketProvider
        angular.forEach($httpProvider.interceptors, function iterator(interceptor) {
          $sailsSocketProvider.interceptors.push(interceptor);
        });



        // Disable spinner from cfpLoadingBar
        cfpLoadingBarProvider.includeSpinner = false;
        cfpLoadingBarProvider.latencyThreshold = 200;

        // Extend default toastr configuration with application specified configuration
        angular.extend(
          toastrConfig,
          {
            allowHtml: true,
            closeButton: true,
            extendedTimeOut: 3000
          }
        );

        // Yeah we wanna to use HTML5 urls!
        $locationProvider
          .html5Mode({
            enabled: false, // disable html5 mode
            requireBase: false
          })
          .hashPrefix('!');

        // Main state provider for frontend application
        $stateProvider
          .state('frontend', {
            abstract: true,
              data: {
                access : 1
              },
            views: {
              header: {
                templateUrl: 'js/app/core/layout/partials/header.html',
                controller: 'HeaderController'
              },
                sidenav: {
                    templateUrl: 'js/app/core/layout/partials/sidenav.html',
                    controller: 'SidenavController'
                },
              footer: {
                templateUrl: 'js/app/core/layout/partials/footer.html',
                controller: 'FooterController'
              }
            }
          })
        ;

        // For any unmatched url, redirect to /dashboard
        $urlRouterProvider.otherwise('/dashboard');
      }
    ])
  ;


  /**
   * Frontend application run hook configuration. This will attach auth status
   * check whenever application changes URL states.
   */
  angular.module('frontend')
    .run([
      '$rootScope', '$state', '$injector',
      'editableOptions','editableThemes','$templateCache','NodesService',
      'AuthService','cfpLoadingBar',
      function run(
        $rootScope, $state, $injector,
        editableOptions,editableThemes,$templateCache,NodesService,
        AuthService,cfpLoadingBar
      ) {

          $rootScope.$on('$routeChangeStart', function(event, next, current) {
              if (typeof(current) !== 'undefined'){
                  $templateCache.remove(current.templateUrl);
              }
          });

          editableThemes.bs3.buttonsClass = 'btn-sm btn-link';

          $rootScope.moment = window.moment
          $rootScope.KONGA_CONFIG = window.KONGA_CONFIG

          // Set usage of Bootstrap 3 CSS with angular-xeditable
          editableOptions.theme = 'bs3';

        /**
         * Route state change start event, this is needed for following:
         *  1) Check if user is authenticated to access page, and if not redirect user back to login page
         */
        $rootScope.$on('$stateChangeStart', function stateChangeStart(event, toState, params) {

            cfpLoadingBar.start();

            if(toState.name == 'auth.login' && AuthService.isAuthenticated()) {
                event.preventDefault();
                $state.go('dashboard', params, {location: 'replace'})
            }


            if(toState.data.needsSignupEnabled && !$rootScope.KONGA_CONFIG.signup_enable) {
                event.preventDefault();
                $state.go('auth.login', params, {location: 'replace'})
            }

            //
            //if (!AuthService.authorize(toState.data.access)) {
            //    event.preventDefault();
            //    $state.go('auth.login', params)
            //}
            //
            //if (toState.redirectTo) {
            //    event.preventDefault();
            //    $state.go(toState.redirectTo, params, {location: 'replace'})
            //}

        });

          $rootScope.$on('$stateChangeSuccess', function stateChangeStart(event, toState) {
              $rootScope.$state = toState
              cfpLoadingBar.complete()

          });


        $rootScope.isAuthenticated = function() {
            return AuthService.isAuthenticated()
        }

         //Check for state change errors.
        //$rootScope.$on('$stateChangeError', function stateChangeError(event, toState, toParams, fromState, fromParams, error) {
        //  event.preventDefault();
        //
        //  $injector.get('MessageService')
        //    .error('Error loading the page');
        //
        //  $state.get('error').error = {
        //    event: event,
        //    toState: toState,
        //    toParams: toParams,
        //    fromState: fromState,
        //    fromParams: fromParams,
        //    error: error
        //  };
        //
        //  return $state.go('error');
        //});
      }
    ])
      .controller('MainController',['$log','$scope','$rootScope','Settings','NodeModel',
          'UserService','InfoService','AuthService',
          function($log,$scope,$rootScope,Settings,NodeModel,
                   UserService,InfoService,AuthService){

              $rootScope.user = UserService.user()
              $rootScope.konga_version = window.konga_version
              $log.debug("MainController:User => ", $rootScope.user)

              // ToDo decide whether to use Gateway Info for getting active node version and stuff...
              $scope.$on('user.node.updated',function(ev,node){

                  $log.debug("MainController:onUserNodeUpdated => Fetching Gateway Info")
                  // Fetch and store Gateway Info
                  _fetchGatewayInfo()
              })

              $scope.$on('user.login',function(ev,user){
                    _fetchGatewayInfo()

              })


              if(AuthService.isAuthenticated()) {
                  _fetchGatewayInfo()
                  _fetchSettings()
              }

              function _fetchSettings() {
                  Settings.load()
                      .then(function(settings){
                          $log.debug("MainController:_fetchSettings: =>", settings )
                          $rootScope.konga_settings_id = settings.length ? settings[0].id : null
                          $rootScope.konga_settings = settings.length ? settings[0].data : {}
                      })
              }

              function _fetchGatewayInfo() {
                  InfoService.getInfo()
                      .then(function(response){
                        $rootScope.Gateway = response.data
                        $log.debug("MainController:onUserNodeUpdated:Gateway Info =>",$rootScope.Gateway)
                  })
              }

          }])
  ;
}());
