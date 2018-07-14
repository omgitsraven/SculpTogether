var myColVal;
var strokeWidthFrac;

var enabled;
var permitted;

var palette_refreshControlSystem;
var palette_refreshArtCount;

var userAwaitingDeletion;
var myFilesServer;

var SHAPEMODES = makeEnum(
	'Cube',	'Cylinder',	'Donut',
	'Ball',	'Cone',		'Ring',
	'Bowl',	'Pyramid',	'Pipe'
);
var EDITMODES = makeEnum(
	'Draw','Shape','Erase',
	'Grab','Slide','Turn','Stretch',
	'Save','Load',
	'Moderation',
	'Disabled'
);
var HANDEDNESSES = makeEnum('Right','Left');
var PERMISSIONMODES = makeEnum('Blacklist','Whitelist');
var SELECTIONMETHODS = makeEnum('Click','Drag');
var SELECTIONWHOSE = makeEnum('Mine','Everyone');
var LOADAS = makeEnum('Art','Costume');
var WEARON = makeEnum('Head','Body','Hand');
var WEARSIDE = makeEnum('Right','Left');

var printLoadAsOptionInfo, costumeBodyPartOptionInfo;

function SETUP_palette(){
	
	
	
	
	
	var initialSectionDiv = document.getElementById("initialSection");
	var controlsSectionDiv = document.getElementById("controlsSection");
	
	function hideInitialSection(){
		initialSectionDiv.style.display = "none";
		controlsSectionDiv.style.display = "table";
	}
	
	initialSectionDiv.addEventListener('mouseup',hideInitialSection);//mouseup, because first down is missing for some bizarre reason
	
	
	
	
	var enableButton = document.getElementById('enable');
	var mainRestDiv = document.getElementById('controlsMainRest');
	
	var cursorEnablingHelpDiv = document.getElementById('cursorEnableHelp');
	var helpRestDiv = document.getElementById('generalHelp');
	
	
	
	
	
	
	
	
	
	function makeRadioSet(prefix,choicesEnum,defaultEnumEntry,changeCallback){
		
		var myOptions = [];
		function makeOption(enumEntry){
			
			var optionDiv = document.getElementById(prefix+enumEntry.label);
			if (optionDiv) {//should be safe? (this is since 'disabled' doesn't have a button)
				optionDiv.addEventListener('click',function(){ optionClick(enumEntry); });
				optionDiv.myEnumEntry = enumEntry;
				
				myOptions.push(optionDiv);
			}
			
		}
		for(var i=0; i<choicesEnum._ORDEREDKEYS.length; i++) makeOption(choicesEnum[choicesEnum._ORDEREDKEYS[i]]);
		
		var curOptionChoice;
		function optionClick(enumEntry,initialDefault,skipSideEffects){
			for(var i=0; i<myOptions.length; i++){
				if (myOptions[i].myEnumEntry==enumEntry) {
					myOptions[i].classList.add("selected");
				} else {
					myOptions[i].classList.remove("selected");
				}
			}
			curOptionChoice = enumEntry;
			if (changeCallback && !skipSideEffects) changeCallback(enumEntry,initialDefault);
		}
		optionClick(defaultEnumEntry,true);
		
		return {
			optionClick:optionClick,
			myOptions:myOptions,
			getCurVal:function(){return curOptionChoice;},
			holderDiv:myOptions[0].parentNode.parentNode
		};
		
	}
	
	
	
	
	makeRadioSet(
		'shape',
		SHAPEMODES,
		SHAPEMODES.Ball,
		SCULPT_nextShapeFunc
	);
	
	var editModeOptionInfo = makeRadioSet(
		'mode',
		EDITMODES,
		EDITMODES.Draw,
		editModeChangeFunc
	);
	
	var handOptionInfo = makeRadioSet(
		'handedness',
		HANDEDNESSES,
		HANDEDNESSES.Right,
		handednessChangeFunc
	);
	
	var permissionModeOptionInfo = makeRadioSet(
		'permission',
		PERMISSIONMODES,
		PERMISSIONMODES.Blacklist,
		permissionModeChangeFunc
	);
	
	var selectionMethodOptionInfo = makeRadioSet(
		'selectionMode',
		SELECTIONMETHODS,
		SELECTIONMETHODS.Click,
		selectionMethodChangeFunc
	)
	
	var selectionWhoseOptionInfo = makeRadioSet(
		'selectionWhose',
		SELECTIONWHOSE,
		SELECTIONWHOSE.Mine,
		SCULPT_selectionWhoseChangeFunc
	);
	
	printLoadAsOptionInfo = makeRadioSet(
		'loadAs',
		LOADAS,
		LOADAS.Art,
		loadAsChangeFunc
	);
	
	costumeBodyPartOptionInfo = makeRadioSet(
		'wearOn',
		WEARON,
		WEARON.Head
	);
	
	
	function loadAsChangeFunc(newVal){
		if (newVal == LOADAS.Art) {
			document.getElementById('wearOnChoice').style.display = 'none';
			document.getElementById('wearOnHelp').style.display = 'none';
		} else {
			document.getElementById('wearOnChoice').style.display = 'inline-block';
			document.getElementById('wearOnHelp').style.display = 'inline-block';
		}
	}
	
	
	function selectionMethodChangeFunc(newVal){
		var isClick = (newVal == SELECTIONMETHODS.Click);
		document.getElementById("selectionClickHelp").style.display = isClick ? "block" : "none";
		document.getElementById("selectionDragHelp").style.display = isClick ? "none" : "block";
		
		SCULPT_selectionMethodChangeFunc(newVal);
	}
	
	
	
	document.getElementById("selectionFloodAll").addEventListener('click',function(){
		SCULPT_selectionFloodAll();
	});
	document.getElementById("selectionFloodNone").addEventListener('click',function(){
		SCULPT_selectionFloodNone();
	});
	
	var saveNameField = document.getElementById("saveNameField");
	var saveNameButton = document.getElementById("saveNameOk");
	var saveNameDummy = document.getElementById("saveNameDummy");
	document.getElementById("saveButton").addEventListener('click',function(){
		if (SCULPT_isAnythingSelected()) {
			
			saveNameField.value = "";
			
			saveNameButton.style.display = "inline-block";
			saveNameDummy.style.display = "none";
			
			setOverlay("saveNameOverlay",true);
			
		} else {
			setOverlay("nothingToSaveOverlay",true);
		}
	});
	saveNameButton.addEventListener('click',function(){
		
		saveNameButton.style.display = "none";
		saveNameDummy.style.display = "inline-block";
		
		SCULPT_saveSelection(saveNameField.value,function(){
			setOverlay("saveNameOverlay",false);
			editModeOptionInfo.optionClick(EDITMODES.Load);
		});
		
	});
	document.getElementById("nothingToSaveOk").addEventListener('click',function(){
		setOverlay("nothingToSaveOverlay",false);
	});
	
	
	
	function refreshEnabledness(){
		var effectivelyEnabled;
		switch(curControlSystem){
			case controlSystems.cursor:
				effectivelyEnabled = enabled;
				break;
			case controlSystems.tracked:
				effectivelyEnabled = true;//enclosureSeesGamepad;
				break;
		}
		cursorEnablingHelpDiv.style.display = effectivelyEnabled ? "none" : "block";
		mainRestDiv.style.visibility = effectivelyEnabled ? "visible" : "hidden";
		helpRestDiv.style.display = effectivelyEnabled ? "block" : "none";
		document.getElementById("controlsSub").style.display = effectivelyEnabled ? "table-cell" : "none" ;
	}
	
	
	function refreshPermission(){
		
		var oldPermitted = permitted;
		
		// remember, blacklist mode is actually free-for-all since blacklisting is actually handled by altspace client
		var moderatorTrue = (oldModeratorStatus === true);//don't let -1 "don't know yet" count as true
		var blacklistTrue = isBlacklistMode;
		var whitelistedTrue = !!whitelistInfo.listDivs[userInfo.userId];// checking for the div seems a bit silly but it's all the information I need...
		permitted = moderatorTrue || blacklistTrue || whitelistedTrue ;
		
		
		if (permitted != oldPermitted) {
			
			SCULPT_permissionChange();
			
			if (permitted) {
				editModeOptionInfo.optionClick(EDITMODES.Draw);
			} else {
				editModeOptionInfo.optionClick(EDITMODES.Disabled);
			}
			
			// maybe it's a little silly not to just roll SCULPT_permissionChange into SCULPT_editModeFunc's observation of changing to Disabled mode?
			// but I could see at some point wanting to disable art input without disabling the palette, so let's leave it separate
			
		}
		
	}
	
	
	var oldControlSystem = controlSystems.cursor;//only safe assumption
	
	palette_refreshControlSystem = function(){
		
		console.log("] going from "+oldControlSystem.label+" to "+curControlSystem.label);
		
		//so, simply hiding an option from the HTML isn't a robust idea,
		//because you also have to switch out of that tool if you're switching to a new control system that doesn't have access to it.
		//but as it happens, tracked has everything cursor has, so it's a non-issue at the moment
		//keep it in mind, though
		
		switch(oldControlSystem){
			case controlSystems.cursor:
				enableButton.style.display = "none";
				handOptionInfo.holderDiv.style.display = "block";
				editModeOptionInfo.myOptions[EDITMODES.Grab.index].style.display = "block";
			break;
		}
		
		oldControlSystem = curControlSystem;
		editModeChangeFunc();
		
		switch(curControlSystem){
			case controlSystems.cursor:
				enableButton.style.display = "block";
				handOptionInfo.holderDiv.style.display = "none";
				editModeOptionInfo.myOptions[EDITMODES.Grab.index].style.display = "none";
			break;
			case controlSystems.tracked:
				
			break;
			
		}
		
		refreshEnabledness();
		
	}
	
	palette_refreshControlSystem();
	
	
	
	function setDivsDisplay(ids,val){
		for(var i=0; i<ids.length; i++){
			var curDiv = document.getElementById(ids[i]);
			// somehow fetch what the default display type should be?
			curDiv.style.display = val ? "block" : "none" ;
		}
	}
	
	function setClassnamesDisplay(ids,val){
		var allDivs = document.getElementsByClassName(ids);
		for(var i=0; i<allDivs.length; i++) allDivs[i].style.display = val ? "block" : "none" ;
	}
	
	
	
	function editModeChangeFunc(){
		
		if (!editModeOptionInfo) return;
		
		var newMode = editModeOptionInfo.getCurVal();
		
		setClassnamesDisplay("controlHelp",false);
		setClassnamesDisplay(curControlSystem.label+"Help",true);
		
		setClassnamesDisplay("toolhelp",false);
		setClassnamesDisplay("toolhelp"+newMode.label,true);
		
		SCULPT_editModeFunc(newMode);
		
		function setDivsIfModes(ids,validModes){
			var shouldShow = false;
			for(var modeIndex=0; modeIndex<validModes.length; modeIndex++){
				if (newMode == validModes[modeIndex]) shouldShow = true;
			}
			setDivsDisplay(ids,shouldShow);
		}
		
		setDivsIfModes(["controlsColor"],[EDITMODES.Draw,EDITMODES.Shape]);
		setDivsIfModes(["controlsStroke"],[EDITMODES.Draw]);
		setDivsIfModes(["controlsShape"],[EDITMODES.Shape]);
		setDivsIfModes(["handednessHolder"],[EDITMODES.Draw,EDITMODES.Slide,EDITMODES.Turn,EDITMODES.Stretch]);
		setDivsIfModes(["controlsSave"],[EDITMODES.Save]);
		//hide handedness holder because handedness div itself changes on control type change already
		
		
	}
	
	
	
	var oldModeratorStatus = -1;
	function refreshModeratorStatus(){
		
		function continueModerationCheck(){
			setTimeout(refreshModeratorStatus,500);//moderator status changes aren't particularly frequent, no sense patching into requestAnimationFrame just for this
		}
		
		altspace.getUser().then(
			function(userInfo){
				// note, this updated userInfo is NOT being stored anywhere; the global one is still the one fetched initially!
				
				var newModeratorStatus = userInfo.isModerator;
				//newModeratorStatus = true;//DEBUG!!
				
				if (oldModeratorStatus != newModeratorStatus) {
					
					setDivsDisplay(['moderationOptionsHolder'], newModeratorStatus);
					
					if (oldModeratorStatus) {
						if (editModeOptionInfo.getCurVal() == EDITMODES.Moderation) {
							editModeOptionInfo.optionClick(EDITMODES.Draw);
						}
					}
					
					oldModeratorStatus = newModeratorStatus;
					refreshPermission();
					
				}
				
				continueModerationCheck();
			},
			function(e){
				console.log("get user error during moderation check:",e);
				continueModerationCheck();
			}
		);
		
	}
	refreshModeratorStatus();
	
	
	
	var permissionsServer = syncInstance.child('permissions');
	var isBlacklistMode;
	//note, I'm still calling it 'blacklist mode',
	//but you can't blacklist people any more (you kick them in altspace instead)
	//so blacklist mode is effectively public mode
	
	var permissionModeServer = permissionsServer.child("mode");
	permissionModeServer.on("value",function(newSnapshot){
		
		var newVal = newSnapshot.val();
		if (newVal === null) {//fresh room
			console.log("!! setting initial permission mode!");
			permissionModeServer.set(PERMISSIONMODES.Blacklist.index);
			return;
		}
		
		isBlacklistMode = (newVal == PERMISSIONMODES.Blacklist.index);
		
		setDivsDisplay(["permissionWhitelistMode"],!isBlacklistMode);
		setDivsDisplay(["permissionBlacklistMode"],isBlacklistMode);
		permissionModeOptionInfo.optionClick( isBlacklistMode?PERMISSIONMODES.Blacklist:PERMISSIONMODES.Whitelist, false, true );
		
		refreshPermission();
		
	});
	
	function permissionModeChangeFunc(newEnum,initialDefault){
		if (initialDefault) return;//don't send the default to the server, wait to hear what it is instead
		console.log("my local click is going to set the server's permission mode to",newEnum.index,(newEnum==PERMISSIONMODES.Blacklist)?"(blacklist)":"(whitelist)");
		permissionModeServer.set(newEnum.index);
	}
	
	
	
	function setOverlay(subsectionId,show){
		
		setDivsDisplay([
			"userOverlay",
			"deletionConfirmOverlay",
			"reloadConfirmOverlay",
			"saveNameOverlay",
			"nothingToSaveOverlay"
		],false);//should probably do this with a child crawl but w/e
		
		setDivsDisplay(["overlayHolder",subsectionId],show);
		
	}
	setOverlay("overlayHolder",false);//redundant use of overlayHolder but it had to be something..
	
	
	
	
	function makeGenericUserInfoEntry(newInfo,withThirdInfo,selectFunc,removeFunc){
		
		var newUserHolder = document.createElement('div');
		newUserHolder.className = "userRowHolder";
		
		var leftDiv = document.createElement('div');
		leftDiv.className = "userRowLeft";
		newUserHolder.appendChild(leftDiv);
		
		var rightDiv = document.createElement('div');
		rightDiv.className = "userRowRight";
		newUserHolder.appendChild(rightDiv);
		
		var userNickDiv = document.createElement('div');
		userNickDiv.className = "userNick";
		userNickDiv.innerHTML = newInfo.primaryField;
		leftDiv.appendChild(userNickDiv);
		
		var userIdDiv = document.createElement('div');
		userIdDiv.className = "userId";
		userIdDiv.innerHTML = newInfo.secondaryField;
		leftDiv.appendChild(userIdDiv);
		
		if (withThirdInfo) {
			var thirdDiv = document.createElement('div');
			thirdDiv.className = "thirdDiv";
			leftDiv.appendChild(thirdDiv);
			newUserHolder.thirdDiv = thirdDiv;//bit messy but whatev
		}
		
		if (selectFunc) leftDiv.addEventListener('click',selectFunc);
		
		if (removeFunc) {
			var removeBtnDiv = document.createElement('div');
			removeBtnDiv.className = "userRemove";
			removeBtnDiv.innerHTML = "×";
			rightDiv.appendChild(removeBtnDiv);
			removeBtnDiv.addEventListener('click',removeFunc);
		}
		
		return newUserHolder;
		
	}
	
	
	
	function makeServerListDisplay(server,divId,handlers,reverseOrder){
		
		
		var listInfo = {
			listHolderDiv:document.getElementById(divId),
			listDivs:{}
		};
		
		
		
		server.on("child_added",function(snapshot,prevChildKey){
			
			var newInfo = snapshot.val();
			
			
			var deletionCaller;
			if (handlers.deletion) {
				deletionCaller = function(){
					handlers.deletion(snapshot);
				}
			}
			
			
			
			var newUserHolder = makeGenericUserInfoEntry(
				handlers.processNewInfo(newInfo),
				false,
				( handlers.nameClickFunc ? function(){handlers.nameClickFunc(snapshot)} : null ),
				deletionCaller
			);
			
			if (reverseOrder) {
				listInfo.listHolderDiv.insertBefore(newUserHolder,listInfo.listHolderDiv.firstChild);
			} else {
				listInfo.listHolderDiv.appendChild(newUserHolder);
			}
			listInfo.listDivs[handlers.getInfoKey(snapshot)] = newUserHolder;
			
			
			/* DEBUG: make long list out of nothing to test CSS 
			for(var i=0; i<16; i++){
				var myClone = newUserHolder.cloneNode(true);
				listInfo.listHolderDiv.appendChild(myClone);
			}
			*/
			
			
			if (handlers.changeCallback) handlers.changeCallback();
			
			
		});
		
		
		server.on("child_removed",function(deadSnapshot){
			
			var deadKey = handlers.getInfoKey(deadSnapshot);
			var deadDiv = listInfo.listDivs[deadKey];
			listInfo.listDivs[deadKey] = null;
			listInfo.listHolderDiv.removeChild(deadDiv);//remove click listener too? not worrying abt this tiny infrequent leak for now...
			
			if (handlers.changeCallback) handlers.changeCallback();
			
		});
		
		
		return listInfo;
		
		
	}
	
	
	function processUserInfoDisplay(newInfo){
		return {
			primaryField:newInfo.displayName,
			secondaryField:newInfo.userId
		};
	}
	function getUserInfoKey(snapshot){
		return snapshot.val().userId;
	}
	function handleUserInfoDeletion(snapshot){
		snapshot.ref.remove();
	}
	
	
	var whitelistServer = permissionsServer.child("whitelist");
	var whitelistInfo = makeServerListDisplay(whitelistServer,"permissionWhitelistUsers",{
		changeCallback:refreshPermission,
		processNewInfo:processUserInfoDisplay,
		getInfoKey:getUserInfoKey,
		deletion:handleUserInfoDeletion
	});
	
	
	
	document.getElementById("permissionAddBtn").addEventListener('click',function(){
		setOverlay("userOverlay",true);
	});
	document.getElementById("userOverlayCancel").addEventListener('click',function(){
		setOverlay("userOverlay",false);
	});
	
	
	
	var connectedUsersServer = syncInstance.child('users');
	var connectedlistInfo = makeServerListDisplay(connectedUsersServer,"userOverlayList",{
		
		nameClickFunc:function(snapshot){
			var newInfo = snapshot.val();
			setOverlay("userOverlay",false);
			console.log("requested adding",newInfo.displayName,"to whitelist");
			if (whitelistInfo.listDivs[newInfo.userId]) {
				console.log("User already had drawing permission! Ignoring.");
			} else {
				whitelistServer.push(newInfo);
			}
		},
		
		processNewInfo:processUserInfoDisplay,
		getInfoKey:getUserInfoKey
		
	});
	
	connectedUsersServer.push({
		userId:userInfo.userId,
		displayName:userInfo.displayName
	}).onDisconnect().remove();
	
	
	
	function processArchiveInfo(newInfo){
		
		function pad(num){
			var str = ""+num;
			if (str.length<2) return "0"+str;
			return str;
		}
		
		var ts = new Date(newInfo.timestamp);
		var timestampStr = ts.getFullYear()+"/"+pad(ts.getMonth()+1)+"/"+pad(ts.getDate())+" "+pad(ts.getHours())+":"+pad(ts.getMinutes())+":"+pad(ts.getSeconds());
		
		return {
			primaryField:newInfo.title,
			secondaryField:timestampStr
		};
		
	}
	
	myFilesServer = syncUser.child("archives");
	var myFilesInfo = makeServerListDisplay(myFilesServer,"archivedArtList",{
		
		nameClickFunc:function(snapshot){
			console.log("ARCHIVE NAME CLICK!!!!");
			hidePalette();
			placePrint(snapshot.key);
		},
		
		processNewInfo:processArchiveInfo,
		
		getInfoKey:function(snapshot){
			return snapshot.key;
		},
		
		deletion:function(snapshot){
			
			console.log("ARCHIVE DELETE CLICK!!");
			
			var deletingInfo = processArchiveInfo(snapshot.val());
			displayConfirmationPrompt(
				
				"Are you sure you want to delete the following art archive?",
				deletingInfo.primaryField, deletingInfo.secondaryField,
				"You will never be able to place this art again!",
				
				function(){
					deleteArchive(snapshot.key);
				},
				function(){
					
				}
				
			);
			
		}
		
	},true);
	
	
	
	var confirmDeletionHandler;
	var cancelDeletionHandler;
	function displayConfirmationPrompt(mainText,primaryField,secondaryField,footText,confirmHandler,cancelHandler){
		document.getElementById('deletionConfirmTitle').innerHTML = mainText;
		document.getElementById('deletionConfirmNick').innerHTML = primaryField;
		document.getElementById('deletionConfirmId').innerHTML = secondaryField;
		document.getElementById('deletionConfirmFootnote').innerHTML = footText;
		confirmDeletionHandler = confirmHandler;
		cancelDeletionHandler = cancelHandler;
		setOverlay("deletionConfirmOverlay",true);
	}
	
	
	
	
	
	
	document.getElementById("deletionConfirmYes").addEventListener('click',function(){
		confirmDeletionHandler();
		setOverlay("deletionConfirmOverlay",false);
	});
	document.getElementById("deletionConfirmNo").addEventListener('click',function(){
		cancelDeletionHandler();
		setOverlay("deletionConfirmOverlay",false);
	});
	
	
	var artCountDivs = new Map();
	
	palette_refreshArtCount = function(){
		
		function userHasMadeArt(userId){
			var artUserInfo = artCountList.get(userId);
			return ( artUserInfo && (artUserInfo.strokeCount>0) );
		}
		
		for(var divEntry of artCountDivs){
			var curDivUserId = divEntry[0];
			var curDiv = divEntry[1];
			
			if (!userHasMadeArt(curDivUserId)) {
				curDiv.parentNode.removeChild(curDiv);
				artCountDivs.delete(curDivUserId);
			}
		}
		
		function setupCurEntry(artEntry){
			
			var curUserId = artEntry[0];
			var curUserInfo = artEntry[1];
			
			if (userHasMadeArt(curUserId)) {
				if (!artCountDivs.get(curUserId)) {
					
					// slightly redundant with 'userList' functions above, but different enough that it's probably not worth tying in..
					
					var newDiv = makeGenericUserInfoEntry(
						{
							primaryField:curUserInfo.nick,
							secondaryField:curUserId
						},
						true,
						null,
						function(){
							
							userAwaitingDeletion = curUserId;
							
							displayConfirmationPrompt(
								
								"Are you sure you want to delete the art of:",
								curUserInfo.nick,curUserId,
								"(The art that will be deleted is currently blinking)",
								
								function(){
									SCULPT_deleteArtOfUserId(userAwaitingDeletion);
									userAwaitingDeletion = null;
								},
								function(){
									userAwaitingDeletion = null;
								}
								
							);
							
						}
					);
					document.getElementById('existingArtList').appendChild(newDiv);
					artCountDivs.set(curUserId,newDiv);
					
					/* DEBUG
					for(var i=0; i<16; i++){
						document.getElementById('existingArtList').appendChild(newDiv.cloneNode(true));
					}
					*/
					
				}
				var curDiv = artCountDivs.get(curUserId);
				curDiv.thirdDiv.innerHTML = curUserInfo.strokeCount+" items";
			}
			
		}
		for(var artEntry of artCountList) setupCurEntry(artEntry);//in lieu of 'let' not existing yet...
		
	}
	
	
	
	
	
	
	
	
	
	
	
	
	var handednessServer = syncUser.child('handedness');
	handednessServer.on("value",function(newSnapshot){
		
		var newVal = newSnapshot.val();
		if (newVal === null) {//user's first visit
			console.log("handedness is null, setting it to Right");
			handednessServer.set(HANDEDNESSES.Right.index);
			return;
		}
		
		var newChoiceEnum = HANDEDNESSES[HANDEDNESSES._ORDEREDKEYS[newVal]];
		handOptionInfo.optionClick( newChoiceEnum, false, true );//yeah this whole thing is going the long way around now, isn't it, oof
		
		SCULPT_handChoiceFunc(newChoiceEnum);
		
	});
	
	function handednessChangeFunc(newEnum,initialDefault){
		if (initialDefault) return;//wait for the server's value actually (maybe I should implement this in the option thingy instead..)
		console.log("new handedness click change, passing word to the server...");
		handednessServer.set(newEnum.index);
	}
	
	
	
	
	
	
	enableButton.addEventListener('click',function(){
		
		enabled = !enabled;
		enableButton.innerHTML = (enabled?"Dis":"En")+"able";
		
		if (!enabled) editModeOptionInfo.optionClick(EDITMODES.Draw);
		// always fall back to 'draw'....
		// this isn't quite ideal as a way to put everything away when disabling drawing,
		// because it could become annoying if you're turning drawing on and off frequently?
		// but it's the simplest fix at first glance, and I don't think people are likely to turn it on and off too often, really
		// also I'm sleepy
		
		refreshEnabledness();
		
		curControlSystem.updateEnabledness();//assumes (curControlSystem == controlSystems.cursor) since otherwise button wouldn't exist
		
	});
	
	
	
	
	// https://stackoverflow.com/a/44134328 (adapted)
	function hue2rgb(p, q, t) {
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	}
	function toInt(x,p){
		return Math.round(x * 255) * Math.pow(256,p);
	}
	function hslToHex(h, s, l) {
		s = 1-s;
		l = 1-l;
		var r, g, b;
		if (s === 0) {
			r = g = b = l; // achromatic
		} else {
			var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			var p = 2 * l - q;
			r = hue2rgb(p, q, h + 1 / 3);
			g = hue2rgb(p, q, h);
			b = hue2rgb(p, q, h - 1 / 3);
		}
		return toInt(r,2)+toInt(g,1)+toInt(b,0);
	}
	function colorIntToHex(int){
		var str = myColVal.toString(16);
		while(str.length<6) str = "0"+str;
		return "#"+str;
	}
	
	
	
	
	function setUpSlider(id,defaultVal){
		
		var sliderDiv = document.getElementById(id+"Slider");
		var sliderDisp = document.getElementById(id+"Marker");
		
		
		
		var fracVal = defaultVal;
		function newFracVal(){
			sliderDisp.style.top = (fracVal*100)+"%";
		}
		newFracVal();
		
		sliderDiv.addEventListener('mousedown',function(e){
			
			var oldY = -99999;
			
			function moveFunc(e){
				var newY = e.pageY-sliderDiv.offsetTop;
				var sliderMax = sliderDiv.clientHeight;
				newY = Math.max(0,newY);
				newY = Math.min(newY,sliderMax);
				if (newY == oldY) return;
				fracVal = newY/sliderMax;
				newFracVal();
				refreshColDisplay();
				
				oldY = newY;
			}
			function releaseFunc(e){
				document.body.removeEventListener('mousemove',moveFunc);
				document.body.removeEventListener('mouseup',releaseFunc);
			}
			
			moveFunc(e);
			document.body.addEventListener('mousemove',moveFunc);
			document.body.addEventListener('mouseup',releaseFunc);
			
		});
		
		var info = {};
		info.getVal = function(){
			return fracVal;
		};
		
		return info;
		
	}
	var sliderH = setUpSlider("hue",Math.random());
	var sliderS = setUpSlider("sat",0);
	var sliderL = setUpSlider("lit",0.5);
	
	var sDisp = document.getElementById("satSliderGradBack");
	var lDisp = document.getElementById("litSliderGradBack");
	var cDisp = document.getElementById("colResult");
	function refreshColDisplay(tellServer){
		
		var h = sliderH.getVal();
		var s = sliderS.getVal();
		var l = sliderL.getVal();
		
		myColVal = hslToHex(h,s,l);//cDisp.style.backgroundColor;
		
		sDisp.style.backgroundColor = "hsl("+(h*360)+",100%,50%)";
		lDisp.style.backgroundColor = "hsl("+(h*360)+","+((1-s)*100)+"%,50%)";
		cDisp.style.backgroundColor = colorIntToHex(myColVal);//"hsl("+(h*360)+","+((1-s)*100)+"%,"+((1-l)*100)+"%)";
		
	}
	refreshColDisplay();
	
	
	
	
	var thicknessControl = document.getElementById('thicknessSlider');
	function submitThickness(){
		strokeWidthFrac = thicknessControl.value;
	}
	thicknessControl.addEventListener('change',submitThickness);
	thicknessControl.value = 1/3;
	submitThickness();
	
	
	
	
	
	
	
	
	
	// NOTE TO SELF:
	// if this value ever gets set (in the source) to something LOWER than it has been,
	// then users will be in a constant reload loop.
	// so, be careful when reverting changes, not to revert the version number too!!
	
	var maxVersionServer = syncApp.child("maxVersion");
	maxVersionServer.on("value",function(newSnapshot){
		
		var newVal = newSnapshot.val();
		console.log("SERVER VERSION:",newVal);
		console.log("MY VERSION:",CURRENTVERSION);
		
		if (newVal < CURRENTVERSION) {// (null < anything) is always true, so fresh server works too
			console.log("!! I seem to have a new version! Informing server...");
			maxVersionServer.set(CURRENTVERSION);
		}
		
		if (newVal == CURRENTVERSION) {
			console.log("I have the same version as everyone else. All good.");
		}
		
		if (newVal > CURRENTVERSION) {// (null > anything) is always false, so fresh server won't trigger this
			console.log("!!!!!!!!!!!!!!!!! SOMEONE SAYS THERE'S A NEW VERSION, forcing a reload...");
			
			if (permitted) {
				
				setOverlay("reloadConfirmOverlay",true);
				presentPalette();
				
				setTimeout(function(){
					window.location.reload(true);
				},6000);
				
			} else {
				
				window.location.reload(true);
				
			}
			
		}
		
	});
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	editModeChangeFunc();
	
	
	
	
	
	
	
}

fileReady();
