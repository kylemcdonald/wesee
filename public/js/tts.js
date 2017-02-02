function once(func) {
    var run = false;
    return function() {
        if(!run) {
            run = true;
            func();
        }
    }
}

function getDefaultVoice(voices) {
	var language = navigator.language.toUpperCase();
	var defaults = _.filter(voices, {default: true});
	var localized = _.filter(voices, function (x) {
		return x.lang.toUpperCase() === language;
	});
	var both = _.intersection(defaults, localized);
	if(both.length > 0) {
		// our preference is for a voice that is localized and default
		// (as there can be multiple defaults)
		return both[0];
	} else if(defaults.length > 0) {
		// otherwise we will choose any default if available
		return defaults[0];
	} else if(localized.length > 0) {
		// and if a default isn't defined we'll use something that's local
	} else if(voices.length > 0) {
		// or just use the first available voice
		return voices[0];
	}
	return null;
}

var Speech = (function() {
	var voices;
	var speaking = false;
	var quietUrl = window.location.search.indexOf('quiet') > -1;
	var onMobile = navigator.userAgent.match(/Mobile|Android|iPhone|iPod/);
	var defaultMaxLength = 5000;
	var clickLoopTimeout = 100;

	function speakImplementation(settings) {
		if(settings.text == undefined) {
			return;
		}
		// bug: sometimes speechSynthesis gets stuck speaking
		// if you call cancel(), you can restart it
		if(speechSynthesis.speaking) {
			speechSynthesis.cancel();
		}
		var msg = new SpeechSynthesisUtterance(settings.text);
		msg.onstart = function() {
			// console.log('onstart');
			if(settings.onstart) {
				settings.onstart();
			}
		}
		var endOnce = once(function() {
			// console.log('onend');
			if(settings.onend) {
				// bug: if you try to talk right after speaking,
				// the tts engine isn't ready yet. timeout fixes it.
				setTimeout(settings.onend, 0);
			}
		});
		module.end = endOnce;
		msg.onend = endOnce;
		var volume = module.quiet ? 0 : 1;
		msg.volume = typeof(settings.volume) === 'undefined' ? volume : settings.volume;
		var speakOnce = once(function() {
			// console.log('speak');
			// wait to assign the voice until speakOnce has been called & it's ready
			if(settings.voice) {
				msg.voice = _.find(voices, {name: settings.voice});
			}
			// safari does not speak without a voice being set
			if(!msg.voice) {
				msg.voice = getDefaultVoice(voices);
			}
			// console.log(msg);
			speechSynthesis.speak(msg);
		});
		// bug: safari does not have support for onvoiceschanged
		if (!voices) {
			// console.log('voices not ready');
			if (typeof(speechSynthesis.onvoiceschanged) === 'undefined') {
				// console.log('loading voices (blocking)');
				voices = speechSynthesis.getVoices();
				// console.log('voices loaded');
			} else {
				// bug: if you try to talk before onvoiceschanged
				// the tts engine can crash
				speechSynthesis.onvoiceschanged = function() {
					voices = speechSynthesis.getVoices();
					// console.log('voices loaded');
					// calling speakOnce without a timeout with not work
					setTimeout(speakOnce, 0);
				}
				// console.log('loading voices (async)');
				speechSynthesis.getVoices();
			}
		}
		if (voices) {
			// console.log('voices ready');
			speakOnce();
		}
		// bug: tts engine doesn't always report that it has ended
		// this puts a max time of on any tts
		setTimeout(endOnce, settings.maxLength || defaultMaxLength);
	};

	var module = {};

	module.quiet = onMobile || quietUrl;

	module.cancel = function () {
		speechSynthesis.cancel();
	}

	if (!onMobile) {
		// on desktop, speaking can be called directly
		module.speak = speakImplementation;
	} else {
		// on mobile, we need to get permission to speak with a tap
		// so we start with speaking only storing the most recent
		var recent, shortCircuit;
		function placeholder (settings) {
			recent = settings;
			shortCircuit = setTimeout(settings.onend, settings.maxLength || defaultMaxLength);
		}
		module.speak = placeholder;
		// and then when we have a click, we speak and connect the implementation
		$(document).click(function () {
			if(module.speak === placeholder) {
				clearTimeout(shortCircuit);
				recent.volume = 1; // force this to play
				speakImplementation(recent);
				module.speak = speakImplementation;
			}
		});
	}

	return module;
})();

function say(text, cb) {
	Speech.speak({
		text: text,
		onend: cb
	})
}
