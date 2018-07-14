
/*
	
	
	TODO:
	
	
	
	
	
	
	
	THINGS TO WATCH/TUNE ONGOING:
	
	- bucket size?? (raise to help with rooms with lots of art; lower to help with rooms with lots of users! what's the priority! make a heuristic if necessary?)
	
	
	
	
	MAYBES:
	
	- "reveal whoever made what I'm pointing at" tool?
	- make art selection raycast more generous somehow???
	- break archives into live geometry?
	- feature to save entire room exactly in place?
	- use different transformation for wearables depending on user's avatar choice?? (uuuuuuugh)
	- find and clean up all the remaining "teleport on mouseup" situations? (this is not my fault and imo not worth pulling my hair out to work around...)
	
	
	
	
	UNEXPLAINED BUGS:
	
	- last chunk of progress stroke gets duplicated and is visible even after merging ('white flicker' during bucket debug mode)
	   (very rare but still happening)
	   (starting to think this might be an altspace client bug actually???)
	
	
	BLOCKING ALTSPACE BUGS:
	- non-admins can't click the document at all
	- no storage permission on production server
	
	
	ANNOYING BUT NOT CRUCIAL ALTSPACE BUGS:
	- can't get mousemove outside of enclosure bounds (even in fullspace) -- means 2D users can only use it in SDK Grid space
	- can't type without avatar moving around on WASD
	- vertex colors are all wrong on mobile (gamma bug)
	- document is randomly the wrong size in different spaces
	
	
	
	ALTSPACE BUGS I'VE CURRENTLY HARDCODED WORKAROUNDS TO:
	- mouseup without teleporting
	- get focus when clicking cockpit-parented entities
	- can't hide document
	- document physical size bug
	- document layout size bug -- I'm just letting it be for now, but if they ever fix it, make sure mobile help still fits!!
	- reused materials do all kinds of bonkers things that I can't even understand
	- click-catcher system is extremely ill-suited to arbitrary environments
	
	
	ISSUES THAT I'VE LEFT INTACT BECAUSE ALTSPACE POLICY IS NOT TO WORRY ABOUT IT:
	- zero authentication, whatsoever, anywhere
	   (altspace has no api token system or anything)
	- nothing cleaning up after the expired sessions that are currently just sitting taking up space on the firebase real-time database
	   (no way to distinguish between rooms that are abandoned, vs ones that people wanted to keep but just haven't been visited in a while, afaik)
	
	
	
	
*/





var DEBUG_SKIPTOLAYOUT = false;//for just visually checking out






var skeletonInfo,userInfo,documentInfo;
var headJoint;

var syncApp;
var syncInstance;
var syncUser;

var storageApp;

function getHeadYaw(){
	var headRot = headJoint.rotation.clone();//don't know if clone is STRICTLY necessary, but let's avoid touching bones
	headRot.reorder('YXZ');
	return headRot.y;
}







function SETUP_main(){
	
	
	
	doAllPromises([
		
		function(callWhenDone){
			
			altspace.getUser().then(
				function(_userInfo){
					console.log("get user success.");
					userInfo = _userInfo;
					
					
					altspace.getSpace().then(
						
						function(spaceInfo){
							console.log("get space success.");
							
							
							firebase.initializeApp(firebaseConfig);
							
							var totalDatabase = firebase.database().ref();
							syncApp = totalDatabase.child("ravenworks:sculpTogether").child("app");
							syncInstance = syncApp.child("instances").child(spaceInfo.sid);
							syncUser = syncApp.child("users").child(userInfo.userId);
							
							var totalStorage = firebase.storage().ref();
							storageApp = totalStorage.child("ravenworks:sculpTogether").child("app");//just imitating altspace's sync paths for consistency's sake
							
							
							callWhenDone();
							
						},
						function(e){
							console.log("get space error:",e);
						}
						
					);
					
				},
				function(e){
					console.log("get user error:",e);
				}
			);
			
		},
		
		function(callWhenDone){
			
			altspace.getEnclosure().then(
				
				function(enclosureInfo){
					console.log("get enclosure success.");
					
					enclosureInfo.requestFullspace().then(
						
						function(){
							console.log("get fullspace success.");
							callWhenDone();
						},
						function(e){
							console.log("get fullspace error:",e);
						}
						
					);
				},
				function(e){
					console.log("get enclosure error:",e);
				}
				
			);
			
		},
		
		function(callWhenDone){
			altspace.getThreeJSTrackingSkeleton().then(
				function(_skeletonInfo){
					console.log("get skeleton success.");
					skeletonInfo = _skeletonInfo;
					headJoint = skeletonInfo.getJoint('Head');
					callWhenDone();
				},
				function(e){
					console.log("get skeleton error:",e);
				}
			);
		},
		
		function(callWhenDone){
			altspace.getDocument().then(
				function(_documentInfo){
					console.log("get document success.");
					documentInfo = _documentInfo;
					documentInfo.inputEnabled = true;
					callWhenDone();
				},
				function(e){
					console.log("get document error:",e);
				}
			);
		}
		
	],function(){
		console.log("all setup promises done!");
		
		// both, right? in case it's already loaded? in which case the event will never go off anyway?
		document.onreadystatechange = attemptContinue;
		attemptContinue();
	});
	
	
	
	function attemptContinue(){
		
		console.log("attempting continue...");
		
		if (document.readyState != "complete") return;//pretty sure this is redundant with the new fileReady thing, but it doesn't hurt anything
		
		console.log("...document is loaded, continuing.");
		
		setTimeout(sectionsSetup,0);//break out of try/catch hell (sadly still necessary even with this new promise structure)
		
		
	};
	
	
	
	
	
	function sectionsSetup(){
		
		console.log("setting up sections...");
		SETUP_io();
		SETUP_sculpt();
		SETUP_palette();
		
	}
	
	
	
	
}

/*
setInterval(function(){
	console.log("window size:",window.innerWidth,window.innerHeight);
	document.getElementById("debugMsg").innerHTML = window.innerWidth+" x "+window.innerHeight;
},2000);
*/

if (DEBUG_SKIPTOLAYOUT) {
	document.getElementById('initialSection').style.display = "none";
	document.getElementById('controlsSection').style.display = "table";
	document.getElementById('cursorEnableHelp').style.display = "block";
	document.getElementById('enable').addEventListener('click',function(){
		document.getElementById('cursorEnableHelp').style.display = "none";
		document.getElementById('controlsMainRest').style.visibility = "visible";
		//document.getElementById('cursor_0').style.display = "block";
	});
	document.getElementById('modeDraw').classList.add("selected");
	document.getElementById('handednessRight').classList.add("selected");
	document.getElementById('shapeCone').classList.add("selected");
} else {
	fileReady();
}

