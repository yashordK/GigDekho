import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { Link, Links, Meta, NavLink, Navigate, Outlet, Scripts, ScrollRestoration, ServerRouter, UNSAFE_withComponentProps, useLoaderData, useLocation, useNavigate, useParams } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowDownAZ, Award, Banknote, Bell, Briefcase, Calendar, Check, CheckCircle2, ChevronRight, Clock, Edit2, Home, Info, Lock, LogOut, Mail, MailCheck, MapPin, Phone, RefreshCw, ShieldCheck, SlidersHorizontal, Star, User, Users, Wallet, X, Zap } from "lucide-react";
import { createServerClient } from "@supabase/ssr";
//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region app/entry.server.tsx
var entry_server_exports = /* @__PURE__ */ __exportAll({
	default: () => handleRequest,
	streamTimeout: () => streamTimeout
});
var streamTimeout = 5e3;
function handleRequest(request, responseStatusCode, responseHeaders, routerContext, loadContext) {
	if (request.method.toUpperCase() === "HEAD") return new Response(null, {
		status: responseStatusCode,
		headers: responseHeaders
	});
	return new Promise((resolve, reject) => {
		let shellRendered = false;
		let userAgent = request.headers.get("user-agent");
		let readyOption = userAgent && isbot(userAgent) || routerContext.isSpaMode ? "onAllReady" : "onShellReady";
		let timeoutId = setTimeout(() => abort(), streamTimeout + 1e3);
		const { pipe, abort } = renderToPipeableStream(/* @__PURE__ */ jsx(ServerRouter, {
			context: routerContext,
			url: request.url
		}), {
			[readyOption]() {
				shellRendered = true;
				const body = new PassThrough({ final(callback) {
					clearTimeout(timeoutId);
					timeoutId = void 0;
					callback();
				} });
				const stream = createReadableStreamFromReadable(body);
				const isDev = process.env.NODE_ENV === "development" || false;
				responseHeaders.set("Content-Type", "text/html");
				if (!isDev) {
					responseHeaders.set("X-Content-Type-Options", "nosniff");
					responseHeaders.set("X-Frame-Options", "DENY");
					responseHeaders.set("X-XSS-Protection", "1; mode=block");
					responseHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
					responseHeaders.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
					responseHeaders.set("Content-Security-Policy", [
						"default-src 'self'",
						"script-src 'self' 'unsafe-inline'",
						"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
						"font-src 'self' https://fonts.gstatic.com data:",
						"img-src 'self' data: https: blob:",
						"connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com",
						"media-src 'self' blob:",
						"worker-src 'self' blob:",
						"frame-src https://api.razorpay.com",
						"frame-ancestors 'none'"
					].join("; "));
				}
				pipe(body);
				resolve(new Response(stream, {
					headers: responseHeaders,
					status: responseStatusCode
				}));
			},
			onShellError(error) {
				reject(error);
			},
			onError(error) {
				responseStatusCode = 500;
				if (shellRendered) console.error(error);
			}
		});
	});
}
//#endregion
//#region app/context/AuthContext.jsx
var AuthContext = createContext({});
var AuthProvider = ({ children }) => {
	const [user, setUser] = useState(null);
	const [profile, setProfile] = useState(null);
	const [loading, setLoading] = useState(true);
	console.log("AuthProvider Render:", {
		user: user?.id,
		profile: !!profile,
		loading
	});
	useEffect(() => {
		console.log("AuthProvider mount: fetching session");
		(void 0).auth.getSession().then(({ data: { session } }) => {
			console.log("getSession resolved:", { hasSession: !!session });
			setUser(session?.user ?? null);
			if (session?.user) fetchProfile(session.user.id);
			else setLoading(false);
		});
		const { data: { subscription } } = (void 0).auth.onAuthStateChange((_event, session) => {
			console.log("onAuthStateChange fired:", _event, { hasSession: !!session });
			setUser(session?.user ?? null);
			if (session?.user) fetchProfile(session.user.id);
			else {
				setProfile(null);
				setLoading(false);
			}
		});
		return () => {
			console.log("AuthProvider unmount: unsubscribing");
			subscription.unsubscribe();
		};
	}, []);
	const fetchProfile = async (userId) => {
		console.log("fetchProfile called for:", userId);
		try {
			const { data, error } = await (void 0).from("profiles").select("*").eq("id", userId).maybeSingle();
			console.log("fetchProfile DB result:", {
				data,
				error
			});
			if (!error && data) setProfile(data);
			else setProfile(null);
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	};
	const signOut = async () => {
		setLoading(true);
		await (void 0).auth.signOut();
		setUser(null);
		setProfile(null);
		setLoading(false);
	};
	return /* @__PURE__ */ jsx(AuthContext.Provider, {
		value: {
			user,
			profile,
			setProfile,
			loading,
			signOut
		},
		children
	});
};
var useAuth = () => useContext(AuthContext);
//#endregion
//#region app/root.tsx
var root_exports = /* @__PURE__ */ __exportAll({
	Layout: () => Layout,
	default: () => root_default
});
function Layout({ children }) {
	return /* @__PURE__ */ jsxs("html", {
		lang: "en",
		children: [/* @__PURE__ */ jsxs("head", { children: [
			/* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
			/* @__PURE__ */ jsx("meta", {
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			}),
			/* @__PURE__ */ jsx("meta", {
				name: "theme-color",
				content: "#F4511E"
			}),
			/* @__PURE__ */ jsx("link", {
				rel: "icon",
				type: "image/x-icon",
				href: "/favicon.ico"
			}),
			/* @__PURE__ */ jsx("link", {
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			}),
			/* @__PURE__ */ jsx("link", {
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			}),
			/* @__PURE__ */ jsx("link", {
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap",
				rel: "stylesheet"
			}),
			/* @__PURE__ */ jsx(Meta, {}),
			/* @__PURE__ */ jsx(Links, {})
		] }), /* @__PURE__ */ jsxs("body", {
			style: {
				backgroundColor: "#111111",
				color: "#ffffff",
				margin: 0
			},
			children: [
				/* @__PURE__ */ jsx("a", {
					href: "#main-content",
					style: {
						position: "absolute",
						left: "-9999px",
						top: "auto",
						width: "1px",
						height: "1px",
						overflow: "hidden"
					},
					onFocus: (e) => {
						const el = e.currentTarget;
						el.style.cssText = "position:fixed;top:1rem;left:1rem;width:auto;height:auto;padding:0.5rem 1rem;background:#F4511E;color:#fff;border-radius:6px;z-index:9999;font-weight:500;";
					},
					onBlur: (e) => {
						const el = e.currentTarget;
						el.style.cssText = "position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;";
					},
					children: "Skip to main content"
				}),
				/* @__PURE__ */ jsx(AuthProvider, { children }),
				/* @__PURE__ */ jsx(ScrollRestoration, {}),
				/* @__PURE__ */ jsx(Scripts, {})
			]
		})]
	});
}
var root_default = UNSAFE_withComponentProps(function Root() {
	return /* @__PURE__ */ jsx(Outlet, {});
});
//#endregion
//#region app/routes/home.tsx
var home_exports = /* @__PURE__ */ __exportAll({
	default: () => home_default,
	meta: () => meta$1
});
var meta$1 = () => [
	{ title: "GigDekho — Find Local Short-Term Work in Indore" },
	{
		name: "description",
		content: "GigDekho connects event organizers and local businesses in Indore with students and part-timers for short-term roles — waitstaff, event helpers, DJs, security, and more. Post a gig or start earning today."
	},
	{
		property: "og:title",
		content: "GigDekho — Local Gigs, Real Earnings"
	},
	{
		property: "og:description",
		content: "Post a gig or find local work in Indore. Waiters, volunteers, event coordinators, singers, DJs and more — get hired same day."
	},
	{
		property: "og:type",
		content: "website"
	},
	{
		property: "og:url",
		content: "https://gigdekho.com"
	},
	{
		name: "keywords",
		content: "local gig work Indore, event helpers Indore, part time work Indore, waiter job, event coordinator, DJ booking Indore, singer booking, short term work Madhya Pradesh, gig dekho"
	}
];
var home_default = UNSAFE_withComponentProps(function LandingScreen() {
	const navigate = useNavigate();
	const { user, profile } = useAuth();
	console.log("LandingScreen Render:", {
		user: user?.id,
		profile: !!profile
	});
	useEffect(() => {
		console.log("LandingScreen redirect useEffect triggered:", {
			user: !!user,
			profile: !!profile
		});
		if (user && profile?.full_name) {
			console.log("LandingScreen redirecting to worker/organizer home");
			navigate(profile.role === "organizer" ? "/organizer/home" : "/worker/home");
		}
	}, [
		user,
		profile,
		navigate
	]);
	const handleWorkerFlow = () => {
		localStorage.setItem("hasSeenLanding", "true");
		navigate("/worker/home");
	};
	const handleOrganizerFlow = () => {
		localStorage.setItem("userIntent", "organizer");
		navigate("/auth");
	};
	return /* @__PURE__ */ jsxs("main", {
		id: "main-content",
		className: "min-h-screen font-sans relative flex flex-col lg:flex-row overflow-hidden",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "absolute top-0 left-0 w-full p-6 lg:p-10 flex flex-col items-center justify-center z-50 pointer-events-none",
				children: [/* @__PURE__ */ jsxs("h1", {
					className: "text-2xl lg:text-3xl font-bold tracking-tight drop-shadow-md",
					style: { color: "#F5F5F5" },
					children: ["Gig", /* @__PURE__ */ jsx("span", {
						className: "text-[#F4511E] italic font-black",
						children: "Dekho"
					})]
				}), /* @__PURE__ */ jsx("p", {
					className: "text-xs font-black uppercase tracking-widest mt-1 drop-shadow-sm",
					style: { color: "rgba(245,245,245,0.5)" },
					children: "Indore's #1 gig platform"
				})]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "hidden lg:flex absolute inset-0 z-40 items-center justify-center pointer-events-none",
				children: /* @__PURE__ */ jsx("div", {
					className: "h-full w-px bg-white/10 relative",
					children: /* @__PURE__ */ jsx("div", {
						className: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-[#1C1C1C] rounded-full flex items-center justify-center text-white/40 font-bold text-sm shadow-md border border-white/10",
						children: "OR"
					})
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "w-full lg:w-1/2 min-h-[50vh] lg:min-h-screen bg-[#1A0800] p-8 lg:p-20 flex flex-col justify-center items-center text-center relative z-10 pt-32 lg:pt-20 overflow-hidden",
				children: [
					/* @__PURE__ */ jsx("div", { className: "absolute bottom-[-60px] right-[-60px] w-[300px] h-[300px] bg-[#F4511E]/10 rounded-full blur-3xl pointer-events-none" }),
					/* @__PURE__ */ jsx("div", {
						className: "w-24 h-24 lg:w-32 lg:h-32 bg-[#2A1000] rounded-full shadow-inner flex items-center justify-center text-5xl lg:text-6xl mb-8 border border-[#F4511E]/20 transform -rotate-6",
						children: "💼"
					}),
					/* @__PURE__ */ jsx("h2", {
						className: "text-4xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-4",
						children: "Want to earn?"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-white/60 font-medium text-lg lg:text-xl lg:max-w-md mb-8 leading-relaxed",
						children: "Find gigs at events near you. Get paid the same day."
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-center justify-center gap-2 lg:gap-3 mb-10 text-[11px] lg:text-xs font-black tracking-widest text-[#F4511E] uppercase",
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "bg-[#F4511E]/10 px-3 py-1.5 rounded-full border border-[#F4511E]/20",
								children: "500+ workers"
							}),
							/* @__PURE__ */ jsx("span", {
								className: "hidden lg:inline text-white/20",
								children: "•"
							}),
							/* @__PURE__ */ jsx("span", {
								className: "bg-[#F4511E]/10 px-3 py-1.5 rounded-full border border-[#F4511E]/20",
								children: "₹3,000 avg earning"
							}),
							/* @__PURE__ */ jsx("span", {
								className: "hidden lg:inline text-white/20",
								children: "•"
							}),
							/* @__PURE__ */ jsx("span", {
								className: "bg-[#F4511E]/10 px-3 py-1.5 rounded-full border border-[#F4511E]/20",
								children: "1hr payout"
							})
						]
					}),
					/* @__PURE__ */ jsx("button", {
						onClick: handleWorkerFlow,
						className: "w-full max-w-[320px] lg:max-w-[380px] min-h-[56px] bg-[#F4511E] hover:bg-[#D84315] text-white font-black text-base lg:text-lg rounded-full shadow-lg hover:shadow-xl hover:shadow-[#F4511E]/30 transition-all btn-tap mb-4",
						children: "Start Earning →"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-white/30 font-bold text-[11px] lg:text-xs",
						children: "Students, freelancers, artists welcome"
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "w-full lg:w-1/2 min-h-[50vh] lg:min-h-screen bg-[#111111] p-8 lg:p-20 flex flex-col justify-center items-center text-center relative z-10 pb-20 overflow-hidden",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "absolute inset-0 opacity-[0.03]",
						style: {
							backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
							backgroundSize: "40px 40px"
						}
					}),
					/* @__PURE__ */ jsx("div", {
						className: "w-24 h-24 lg:w-32 lg:h-32 bg-[#1C1C1C] rounded-full shadow-inner flex items-center justify-center text-5xl lg:text-6xl mb-8 border border-white/10 transform rotate-6 relative z-10",
						children: "🎪"
					}),
					/* @__PURE__ */ jsx("h2", {
						className: "text-4xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-4 relative z-10",
						children: "Hosting an event?"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-white/50 font-medium text-lg lg:text-xl lg:max-w-md mb-8 leading-relaxed relative z-10 text-center",
						children: "Find verified staff and performers instantly. Any role, any scale."
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-center justify-center gap-2 lg:gap-3 mb-10 text-[11px] lg:text-xs font-black tracking-widest text-white/40 uppercase relative z-10",
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "bg-white/5 px-3 py-1.5 rounded-full border border-white/10",
								children: "200+ organizers"
							}),
							/* @__PURE__ */ jsx("span", {
								className: "hidden lg:inline",
								children: "•"
							}),
							/* @__PURE__ */ jsx("span", {
								className: "bg-white/5 px-3 py-1.5 rounded-full border border-white/10",
								children: "Verified workers"
							}),
							/* @__PURE__ */ jsx("span", {
								className: "hidden lg:inline",
								children: "•"
							}),
							/* @__PURE__ */ jsx("span", {
								className: "bg-white/5 px-3 py-1.5 rounded-full border border-white/10",
								children: "Instant matching"
							})
						]
					}),
					/* @__PURE__ */ jsx("button", {
						onClick: handleOrganizerFlow,
						className: "w-full max-w-[320px] lg:max-w-[380px] min-h-[56px] bg-transparent border-2 border-white/30 hover:border-white hover:bg-white hover:text-[#111111] text-white font-black text-base lg:text-lg rounded-full transition-all btn-tap mb-4 relative z-10",
						children: "Post a Gig →"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-white/20 font-bold text-[11px] lg:text-xs relative z-10",
						children: "Weddings, clubs, colleges, corporates"
					})
				]
			})
		]
	});
});
//#endregion
//#region app/components/AuthLeftPanel.jsx
function AuthLeftPanel() {
	return /* @__PURE__ */ jsxs("div", {
		className: "hidden lg:flex flex-col justify-between bg-primary text-white p-16 lg:w-1/2 min-h-screen relative overflow-hidden",
		children: [
			/* @__PURE__ */ jsx("div", { className: "absolute top-[-100px] right-[-100px] w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" }),
			/* @__PURE__ */ jsx("div", { className: "absolute bottom-[100px] left-[-50px] w-72 h-72 bg-blue-400/20 rounded-full blur-2xl pointer-events-none" }),
			/* @__PURE__ */ jsxs("div", {
				className: "relative z-10 flex-col space-y-12",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "space-y-4",
					children: [/* @__PURE__ */ jsx("h1", {
						className: "text-[56px] font-black leading-tight tracking-tight max-w-[500px]",
						children: "Your next gig is one tap away."
					}), /* @__PURE__ */ jsxs("div", {
						className: "flex flex-col space-y-3 pt-6",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex items-center text-lg font-bold bg-white/10 w-fit px-5 py-2.5 rounded-full border border-white/20",
								children: [/* @__PURE__ */ jsx("span", {
									className: "mr-3",
									children: "⚡"
								}), " 500+ workers earning weekly"]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "flex items-center text-lg font-bold bg-white/10 w-fit px-5 py-2.5 rounded-full border border-white/20",
								children: [/* @__PURE__ */ jsx("span", {
									className: "mr-3",
									children: "📍"
								}), " Active in Indore"]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "flex items-center text-lg font-bold bg-white/10 w-fit px-5 py-2.5 rounded-full border border-white/20",
								children: [/* @__PURE__ */ jsx("span", {
									className: "mr-3",
									children: "💸"
								}), " Payouts within 1 hour"]
							})
						]
					})]
				}), /* @__PURE__ */ jsxs("div", {
					className: "space-y-5",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "bg-white rounded-2xl p-6 text-slate-800 shadow-xl max-w-sm hover:-translate-y-1 transition-transform",
						children: [/* @__PURE__ */ jsx("p", {
							className: "font-bold text-lg mb-3 text-slate-800",
							children: "\"Got paid the same night. Easiest ₹2000 I've made.\""
						}), /* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ jsx("span", {
								className: "font-bold text-sm text-slate-500",
								children: "— Rahul S., Event Helper"
							}), /* @__PURE__ */ jsxs("div", {
								className: "flex text-amber-400",
								children: [
									/* @__PURE__ */ jsx(Star, {
										size: 14,
										className: "fill-current"
									}),
									/* @__PURE__ */ jsx(Star, {
										size: 14,
										className: "fill-current"
									}),
									/* @__PURE__ */ jsx(Star, {
										size: 14,
										className: "fill-current"
									}),
									/* @__PURE__ */ jsx(Star, {
										size: 14,
										className: "fill-current"
									}),
									/* @__PURE__ */ jsx(Star, {
										size: 14,
										className: "fill-current"
									})
								]
							})]
						})]
					}), /* @__PURE__ */ jsxs("div", {
						className: "bg-white rounded-2xl p-6 text-slate-800 shadow-xl max-w-sm translate-x-8 hover:-translate-y-1 transition-transform",
						children: [/* @__PURE__ */ jsx("p", {
							className: "font-bold text-lg mb-3 text-slate-800",
							children: "\"Found 3 gigs in my first week. Legit platform.\""
						}), /* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ jsx("span", {
								className: "font-bold text-sm text-slate-500",
								children: "— Priya M., Singer"
							}), /* @__PURE__ */ jsxs("div", {
								className: "flex text-amber-400",
								children: [
									/* @__PURE__ */ jsx(Star, {
										size: 14,
										className: "fill-current"
									}),
									/* @__PURE__ */ jsx(Star, {
										size: 14,
										className: "fill-current"
									}),
									/* @__PURE__ */ jsx(Star, {
										size: 14,
										className: "fill-current"
									}),
									/* @__PURE__ */ jsx(Star, {
										size: 14,
										className: "fill-current"
									}),
									/* @__PURE__ */ jsx(Star, {
										size: 14,
										className: "fill-current"
									})
								]
							})]
						})]
					})]
				})]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "relative z-10 pt-10",
				children: /* @__PURE__ */ jsxs("h2", {
					className: "text-3xl font-black tracking-tight flex items-center",
					children: [/* @__PURE__ */ jsx("span", {
						className: "bg-white text-primary px-[6px] py-[2px] rounded mr-1",
						children: "Gig"
					}), "Dekho"]
				})
			})
		]
	});
}
//#endregion
//#region app/routes/auth.tsx
var auth_exports = /* @__PURE__ */ __exportAll({ default: () => auth_default });
var auth_default = UNSAFE_withComponentProps(function AuthScreen() {
	const [email, setEmail] = useState("");
	const [step, setStep] = useState("email");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [countdown, setCountdown] = useState(0);
	const navigate = useNavigate();
	const { user, profile, loading: authLoading } = useAuth();
	console.log("AuthScreen Render:", {
		user: user?.id,
		profile: !!profile,
		authLoading
	});
	useEffect(() => {
		console.log("AuthScreen redirect useEffect triggered:", {
			user: !!user,
			profile: !!profile,
			authLoading
		});
		if (authLoading) return;
		if (user) if (profile?.full_name) {
			console.log("AuthScreen: profile complete, redirecting");
			localStorage.removeItem("userIntent");
			const nextUrl = localStorage.getItem("redirectAfterLogin");
			if (nextUrl) {
				localStorage.removeItem("redirectAfterLogin");
				navigate(nextUrl);
			} else navigate(profile.role === "organizer" ? "/organizer/home" : "/worker/home");
		} else {
			console.log("AuthScreen: no profile full name, redirecting to setup-profile");
			navigate("/setup-profile");
		}
	}, [
		user,
		profile,
		authLoading,
		navigate
	]);
	useEffect(() => {
		let timer;
		if (countdown > 0) timer = setInterval(() => {
			setCountdown((prev) => prev - 1);
		}, 1e3);
		return () => clearInterval(timer);
	}, [countdown]);
	if (authLoading || user) return /* @__PURE__ */ jsx("div", {
		className: "min-h-screen flex items-center justify-center bg-background",
		children: /* @__PURE__ */ jsx("div", { className: "w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" })
	});
	const handleSendLink = async (e) => {
		if (e && e.preventDefault) e.preventDefault();
		setLoading(true);
		setError("");
		try {
			const { error } = await (void 0).auth.signInWithOtp({ email });
			if (error) throw error;
			setStep("waiting");
			setCountdown(30);
		} catch (err) {
			setError(err.message || "Something went wrong. Try again.");
		} finally {
			setLoading(false);
		}
	};
	const handleManualSessionCheck = async () => {
		setLoading(true);
		setError("");
		const { data: { session } } = await (void 0).auth.getSession();
		if (session) window.location.reload();
		else {
			setLoading(false);
			setError("Still waiting... make sure you're on the same device or try again.");
		}
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-screen lg:flex bg-background",
		children: [/* @__PURE__ */ jsx(AuthLeftPanel, {}), /* @__PURE__ */ jsx("div", {
			className: "flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative",
			children: /* @__PURE__ */ jsxs("div", {
				className: "w-full max-w-[480px] bg-white p-8 lg:p-10 lg:rounded-3xl rounded-2xl border border-slate-100 shadow-sm lg:shadow-xl",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "text-center mb-8",
						children: [/* @__PURE__ */ jsx("h1", {
							className: "text-3xl font-black tracking-tight text-slate-800 mb-2",
							children: step === "email" ? "Welcome back" : "Check your email"
						}), /* @__PURE__ */ jsx("p", {
							className: "text-sm font-medium text-slate-500",
							children: step === "email" ? "Enter your email to sign in or create an account." : `We sent a link to ${email} — tap it on this device to sign in`
						})]
					}),
					error && /* @__PURE__ */ jsx("div", {
						className: "mb-6 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-bold border border-red-100",
						children: error
					}),
					step === "email" && /* @__PURE__ */ jsxs("form", {
						onSubmit: handleSendLink,
						className: "space-y-4",
						children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
							htmlFor: "email-address",
							className: "sr-only",
							children: "Email Address"
						}), /* @__PURE__ */ jsxs("div", {
							className: "relative",
							children: [/* @__PURE__ */ jsx("span", {
								className: "absolute left-4 top-1/2 -translate-y-1/2 text-slate-400",
								children: /* @__PURE__ */ jsx(Mail, { size: 18 })
							}), /* @__PURE__ */ jsx("input", {
								id: "email-address",
								type: "email",
								placeholder: "you@gmail.com",
								"aria-label": "Email Address",
								className: "w-full pl-11 pr-4 py-3 min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-800 font-medium transition-colors",
								value: email,
								onChange: (e) => setEmail(e.target.value),
								required: true
							})]
						})] }), /* @__PURE__ */ jsx("button", {
							type: "submit",
							disabled: loading || !email,
							className: `min-h-[44px] w-full py-3.5 bg-urgency text-white rounded-xl font-bold text-base mt-2 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-500/30 transition-all btn-tap ${!email || loading ? "cursor-not-allowed opacity-70" : ""}`,
							children: loading ? "Sending link..." : "Continue"
						})]
					}),
					step === "waiting" && /* @__PURE__ */ jsxs("div", {
						className: "flex flex-col items-center animate-in fade-in zoom-in duration-300",
						children: [
							/* @__PURE__ */ jsx("div", {
								className: "w-24 h-24 bg-blue-50 text-primary rounded-full flex items-center justify-center mb-6",
								children: /* @__PURE__ */ jsx(MailCheck, { size: 48 })
							}),
							/* @__PURE__ */ jsx("div", {
								className: "hidden lg:block text-slate-500 text-sm font-bold bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg mb-6",
								children: "💡 Opening the link will automatically sign you in."
							}),
							/* @__PURE__ */ jsx("button", {
								onClick: handleSendLink,
								disabled: loading || countdown > 0,
								className: `min-h-[44px] w-full py-3 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors btn-tap ${countdown > 0 ? "cursor-not-allowed" : ""}`,
								children: countdown > 0 ? `Resend in ${countdown}s` : "Resend link"
							}),
							/* @__PURE__ */ jsx("button", {
								onClick: handleManualSessionCheck,
								disabled: loading,
								className: "mt-4 text-sm font-bold text-primary min-h-[44px] py-1 hover:underline",
								children: "I opened the link on a different device"
							}),
							/* @__PURE__ */ jsx("button", {
								onClick: () => {
									setStep("email");
									setError("");
								},
								className: "mt-2 text-xs font-bold text-slate-400 py-2 hover:text-slate-600",
								children: "Wrong email?"
							})
						]
					})
				]
			})
		})]
	});
});
//#endregion
//#region app/routes/setup-profile.tsx
var setup_profile_exports = /* @__PURE__ */ __exportAll({ default: () => setup_profile_default });
var SKILLS_LIST = [
	"Waiter",
	"Bartender",
	"Event Helper",
	"Singer",
	"Dancer",
	"Sketch Artist",
	"Photographer",
	"DJ",
	"Emcee",
	"Security"
];
var setup_profile_default = UNSAFE_withComponentProps(function SetupProfileScreen() {
	const [intent] = useState(() => localStorage.getItem("userIntent") || "worker");
	const [fullName, setFullName] = useState("");
	const [city] = useState("Indore");
	const [selectedSkills, setSelectedSkills] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const navigate = useNavigate();
	const { user, setProfile, loading: authLoading } = useAuth();
	if (authLoading) return /* @__PURE__ */ jsx("div", {
		className: "min-h-screen flex items-center justify-center bg-background",
		children: /* @__PURE__ */ jsx("div", { className: "w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" })
	});
	if (!user) return /* @__PURE__ */ jsx(Navigate, {
		to: "/auth",
		replace: true
	});
	const toggleSkill = (skill) => {
		if (selectedSkills.includes(skill)) setSelectedSkills(selectedSkills.filter((s) => s !== skill));
		else setSelectedSkills([...selectedSkills, skill]);
	};
	const handleCompleteSetup = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		try {
			const { data: newProfile, error: profileError } = await (void 0).from("profiles").upsert({
				id: user.id,
				full_name: fullName,
				city,
				email: user.email,
				role: intent
			}).select().single();
			if (profileError) throw profileError;
			if (selectedSkills.length > 0) {
				const skillsRows = selectedSkills.map((s) => ({
					worker_id: user.id,
					skill: s
				}));
				const { error: skillsError } = await (void 0).from("worker_skills").upsert(skillsRows, { onConflict: "worker_id,skill" });
				if (skillsError) throw skillsError;
			}
			setProfile(newProfile);
			localStorage.removeItem("userIntent");
			const nextUrl = localStorage.getItem("redirectAfterLogin");
			if (nextUrl) {
				localStorage.removeItem("redirectAfterLogin");
				navigate(nextUrl);
			} else navigate(intent === "organizer" ? "/organizer/home" : "/worker/home");
		} catch (err) {
			console.error(err);
			setError("Something went wrong. Try again.");
		} finally {
			setLoading(false);
		}
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-screen lg:flex bg-background",
		children: [/* @__PURE__ */ jsx(AuthLeftPanel, {}), /* @__PURE__ */ jsx("div", {
			className: "flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative overflow-y-auto",
			children: /* @__PURE__ */ jsxs("div", {
				className: "w-full max-w-[480px] bg-white p-8 lg:p-10 lg:rounded-3xl rounded-2xl border border-slate-100 shadow-sm lg:shadow-xl my-auto",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "text-center mb-8",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-4 border border-slate-200 shadow-sm",
								children: [
									"Setting up your ",
									intent,
									" profile"
								]
							}),
							/* @__PURE__ */ jsx("h1", {
								className: "text-3xl font-black text-slate-800 mb-2",
								children: "Create Profile"
							}),
							/* @__PURE__ */ jsx("p", {
								className: "text-sm font-medium text-slate-500",
								children: intent === "worker" ? "Let's get you set up to start earning." : "Let's get you set up to host events."
							})
						]
					}),
					error && /* @__PURE__ */ jsx("div", {
						className: "mb-6 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100",
						children: error
					}),
					/* @__PURE__ */ jsxs("form", {
						onSubmit: handleCompleteSetup,
						className: "space-y-5",
						children: [
							/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
								htmlFor: "full-name",
								className: "block text-sm font-bold text-slate-700 mb-2",
								children: "Full Name"
							}), /* @__PURE__ */ jsx("input", {
								id: "full-name",
								type: "text",
								placeholder: "Rahul Kumar",
								className: "w-full px-4 py-3 min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium",
								value: fullName,
								onChange: (e) => setFullName(e.target.value),
								required: true
							})] }),
							/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
								htmlFor: "city-read-only",
								className: "block text-sm font-bold text-slate-700 mb-2",
								children: "City"
							}), /* @__PURE__ */ jsx("input", {
								id: "city-read-only",
								type: "text",
								className: "w-full px-4 py-3 min-h-[44px] bg-slate-100 text-slate-500 border border-slate-200 rounded-xl font-medium cursor-not-allowed",
								value: city,
								readOnly: true
							})] }),
							intent === "worker" && /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("span", {
								className: "block text-sm font-bold text-slate-700 mb-3",
								children: "Your Skills (Select all that apply)"
							}), /* @__PURE__ */ jsx("div", {
								className: "flex flex-wrap gap-2",
								children: SKILLS_LIST.map((skill) => /* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: () => toggleSkill(skill),
									className: `px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-full border text-sm font-bold transition-colors btn-tap ${selectedSkills.includes(skill) ? "bg-primary border-primary text-white" : "bg-white border-slate-300 text-slate-600 hover:border-primary hover:text-primary"}`,
									children: skill
								}, skill))
							})] }),
							/* @__PURE__ */ jsx("div", {
								className: "pt-4",
								children: /* @__PURE__ */ jsx("button", {
									type: "submit",
									disabled: loading || !fullName,
									className: "min-h-[44px] w-full py-3.5 bg-urgency text-white rounded-xl font-bold text-base hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-50 btn-tap shadow-sm",
									children: loading ? "Saving..." : intent === "worker" ? "Start Earning" : "Go to Dashboard"
								})
							})
						]
					})
				]
			})
		})]
	});
});
//#endregion
//#region app/lib/utils.js
function formatRelativeDate(dateString) {
	if (!dateString) return "";
	const dateObj = new Date(dateString);
	const today = /* @__PURE__ */ new Date();
	const diffDays = (new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / (1e3 * 60 * 60 * 24);
	const timeStr = dateObj.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit"
	});
	if (diffDays === 0) return `Today, ${timeStr}`;
	else if (diffDays === 1) return `Tomorrow, ${timeStr}`;
	else if (diffDays === -1) return `Yesterday, ${timeStr}`;
	return `${dateObj.toLocaleDateString("en-US", { weekday: "short" })} ${dateObj.getDate()} ${dateObj.toLocaleDateString("en-US", { month: "short" })}, ${timeStr}`;
}
//#endregion
//#region app/lib/supabase.server.ts
function parseCookies(header) {
	if (!header) return [];
	return header.split(";").map((c) => {
		const [name, ...rest] = c.trim().split("=");
		return {
			name: name.trim(),
			value: rest.join("=").trim()
		};
	});
}
function createSupabaseServerClient(request) {
	return createServerClient(process.env.VITE_SUPABASE_URL || "https://ananwznqnjxvvqfkbvzm.supabase.co", process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuYW53em5xbmp4dnZxZmtidnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5Mzk5NDgsImV4cCI6MjA5MDUxNTk0OH0.1G7KFPN3AOZ3SNfGP4Svv8TXOTA14h_J203xPEixwfM", { cookies: {
		getAll: () => parseCookies(request.headers.get("Cookie") ?? ""),
		setAll: () => {}
	} });
}
//#endregion
//#region app/routes/gigs.$id.tsx
var gigs_$id_exports = /* @__PURE__ */ __exportAll({
	default: () => gigs_$id_default,
	loader: () => loader$2,
	meta: () => meta
});
async function loader$2({ params, request }) {
	const { data: gig, error } = await createSupabaseServerClient(request).from("gigs").select(`
      id,
      title,
      description,
      role_type,
      pay_rate,
      duration_hrs,
      event_date,
      location_text,
      is_urgent,
      slots_total,
      slots_filled,
      status,
      created_at,
      organizer_id,
      profiles!gigs_organizer_id_fkey (
        full_name,
        avg_rating
      )
    `).eq("id", params.id).single();
	if (error || !gig) throw new Response("Gig not found", { status: 404 });
	return { gig };
}
var meta = ({ data }) => {
	if (!data?.gig) return [{ title: "Gig Not Found — GigDekho" }];
	const { gig } = data;
	const totalPay = gig.pay_rate * gig.duration_hrs;
	const displayRole = gig.role_type;
	const slotsLeft = gig.slots_total - gig.slots_filled;
	const title = `${gig.title} · ${gig.location_text} · ₹${totalPay} — GigDekho`;
	const description = gig.description?.slice(0, 155) ?? `${displayRole} in ${gig.location_text}. Earn ₹${totalPay} for ${gig.duration_hrs}hrs. ${slotsLeft} slot${slotsLeft !== 1 ? "s" : ""} left.`;
	return [
		{ title },
		{
			name: "description",
			content: description
		},
		{
			property: "og:title",
			content: title
		},
		{
			property: "og:description",
			content: description
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			property: "og:url",
			content: `https://gigdekho.com/gigs/${gig.id}`
		},
		{
			name: "robots",
			content: gig.status === "open" ? "index, follow" : "noindex, nofollow"
		}
	];
};
var getImageUrl$2 = (role) => {
	const r = (role || "").toLowerCase();
	let url = "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200";
	if (r.includes("wait") || r.includes("hostess")) url = "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200";
	else if (r.includes("sing") || r.includes("vocal")) url = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200";
	else if (r.includes("dj") || r.includes("disc")) url = "https://images.unsplash.com/photo-1571266028243-d220c6f3f07b?w=1200";
	else if (r.includes("art") || r.includes("sketch")) url = "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1200";
	else if (r.includes("secur") || r.includes("guard") || r.includes("bouncer")) url = "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200";
	else if (r.includes("danc")) url = "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=1200";
	else if (r.includes("photo") || r.includes("camera")) url = "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1200";
	return url + "&auto=format&fit=crop";
};
var gigs_$id_default = UNSAFE_withComponentProps(function GigDetailScreen() {
	const { id } = useParams();
	const navigate = useNavigate();
	const location = useLocation();
	const { user } = useAuth();
	const { gig: ssrGig } = useLoaderData();
	const [gig, setGig] = useState(ssrGig);
	const [loading, setLoading] = useState(false);
	const [applying, setApplying] = useState(false);
	const [applicationStatus, setApplicationStatus] = useState(null);
	const [toastMessage, setToastMessage] = useState("");
	const [isErrorToast, setIsErrorToast] = useState(false);
	const [showTerms, setShowTerms] = useState(false);
	useEffect(() => {
		if (id) fetchData();
	}, [id, user]);
	const fetchData = async () => {
		try {
			const { data: gigData, error: gigError } = await (void 0).from("gigs").select("*").eq("id", id).single();
			if (gigError) throw gigError;
			setGig(gigData);
			if (user) {
				const { data: appData, error: appError } = await (void 0).from("applications").select("status").eq("gig_id", id).eq("worker_id", user.id).maybeSingle();
				if (appError && appError.code !== "PGRST116") throw appError;
				if (appData) setApplicationStatus(appData.status);
			}
		} catch (err) {
			console.error(err);
		}
	};
	const showToast = (msg, isError = false) => {
		setToastMessage(msg);
		setIsErrorToast(isError);
		setTimeout(() => {
			setToastMessage("");
			setIsErrorToast(false);
		}, 3e3);
	};
	const handleApplyClick = () => {
		if (!user) {
			localStorage.setItem("redirectAfterLogin", location.pathname);
			navigate("/auth");
			return;
		}
		setShowTerms(true);
	};
	const handleApply = async () => {
		setShowTerms(false);
		setApplying(true);
		try {
			const { error: appError } = await (void 0).from("applications").insert({
				gig_id: id,
				worker_id: user.id,
				status: "pending"
			});
			if (appError) throw appError;
			const { error: rpcError } = await (void 0).rpc("increment_slots_filled", { gig_id: id });
			if (rpcError) throw rpcError;
			setApplicationStatus("pending");
			setGig((prev) => ({
				...prev,
				slots_filled: (prev.slots_filled || 0) + 1
			}));
			showToast("Applied! We'll notify you when confirmed.");
		} catch (err) {
			console.error("Failed to apply:", err);
			showToast("Something went wrong. Try again.", true);
		} finally {
			setApplying(false);
		}
	};
	if (loading) return /* @__PURE__ */ jsx("div", {
		className: "min-h-screen flex items-center justify-center bg-[#111111]",
		children: /* @__PURE__ */ jsx("div", { className: "w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" })
	});
	if (!gig) return /* @__PURE__ */ jsx("div", {
		className: "p-6 text-center text-slate-500 font-bold",
		children: "Gig not found."
	});
	const payTotal = gig.pay_rate * gig.duration_hrs;
	const imageUrl = getImageUrl$2(gig.role_type);
	return /* @__PURE__ */ jsxs("main", {
		id: "main-content",
		className: "bg-[#111111] min-h-screen pb-24 font-sans relative pt-16",
		children: [
			showTerms && /* @__PURE__ */ jsx("div", {
				className: "fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in",
				children: /* @__PURE__ */ jsxs("div", {
					className: "bg-[#1C1C1C] border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl relative",
					children: [
						/* @__PURE__ */ jsx("h2", {
							className: "text-xl font-black text-white mb-4",
							children: "Terms & Conditions"
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "text-white/60 text-sm font-medium space-y-4 mb-6 max-h-[40vh] overflow-y-auto hide-scrollbar",
							children: [
								/* @__PURE__ */ jsx("p", { children: "1. By applying, you commit to arriving at the gig location on time." }),
								/* @__PURE__ */ jsx("p", { children: "2. Failure to show up without 24 hours prior notice will negatively impact your profile rating and may result in account suspension." }),
								/* @__PURE__ */ jsx("p", { children: "3. You agree to perform the duties required by the organizer professionally." }),
								/* @__PURE__ */ jsx("p", { children: "4. Payments are processed within 1 hour of the organizer marking the gig as completed." })
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "flex space-x-3",
							children: [/* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => setShowTerms(false),
								className: "flex-1 py-3.5 rounded-full font-bold text-white/70 bg-white/10 hover:bg-white/20 transition-colors btn-tap",
								children: "Cancel"
							}), /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: handleApply,
								className: "flex-1 py-3.5 rounded-full font-bold text-white bg-[#F4511E] hover:bg-[#D84315] shadow-lg transition-colors btn-tap",
								children: "I Agree & Apply"
							})]
						})
					]
				})
			}),
			toastMessage && /* @__PURE__ */ jsxs("div", {
				className: `fixed top-24 left-1/2 -translate-x-1/2 z-50 text-white font-bold py-3 px-5 pt-3.5 pb-3 rounded-full shadow-lg flex items-center text-[13px] animate-bounce ${isErrorToast ? "bg-red-500 shadow-red-500/30" : "bg-green-500 shadow-green-500/30"}`,
				children: [isErrorToast ? /* @__PURE__ */ jsx(AlertCircle, {
					size: 18,
					className: "mr-2"
				}) : /* @__PURE__ */ jsx(CheckCircle2, {
					size: 18,
					className: "mr-2"
				}), toastMessage]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "bg-[#111111] z-40 py-4 px-4 lg:px-8 xl:px-12 w-full mx-auto flex items-center",
				children: /* @__PURE__ */ jsxs("span", {
					className: "text-[11px] font-bold text-white/40 tracking-widest uppercase flex items-center",
					children: [
						"Home ",
						/* @__PURE__ */ jsx(ChevronRight, {
							size: 14,
							className: "inline opacity-50 mx-1"
						}),
						"Available Jobs ",
						/* @__PURE__ */ jsx(ChevronRight, {
							size: 14,
							className: "inline opacity-50 mx-1"
						}),
						/* @__PURE__ */ jsx("span", {
							className: "text-white/80",
							children: gig.role_type
						})
					]
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "px-4 lg:px-8 xl:px-12 pb-8 w-full mx-auto",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "w-full h-[240px] lg:h-[320px] rounded-3xl overflow-hidden mb-8 lg:mb-10 shadow-sm relative",
					children: [/* @__PURE__ */ jsx("img", {
						src: imageUrl,
						className: "w-full h-full object-cover",
						alt: gig.role_type
					}), /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" })]
				}), /* @__PURE__ */ jsxs("div", {
					className: "lg:grid lg:grid-cols-[60%_40%] lg:gap-12 items-start",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "w-full",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "mb-8",
								children: [
									gig.is_urgent && /* @__PURE__ */ jsx("div", {
										className: "bg-cyan-500/10 text-[#00BCD4] inline-block px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-cyan-500/20",
										children: "URGENT REQUIREMENT"
									}),
									/* @__PURE__ */ jsx("h1", {
										className: "text-3xl lg:text-5xl font-black text-white tracking-tight leading-[1.05] mb-5",
										children: gig.title
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "flex items-center space-x-3 mb-6 bg-[#1C1C1C] p-3.5 rounded-2xl border border-white/5 shadow-sm self-start max-w-max",
										children: [/* @__PURE__ */ jsx("div", {
											className: "w-10 h-10 bg-white/10 text-white rounded-full flex items-center justify-center font-bold shadow-inner",
											children: "P"
										}), /* @__PURE__ */ jsxs("div", {
											className: "flex flex-col pr-4",
											children: [/* @__PURE__ */ jsxs("span", {
												className: "font-bold text-white text-[13px] flex items-center",
												children: ["Platform Planners ", /* @__PURE__ */ jsx(ShieldCheck, {
													size: 14,
													className: "text-[#F4511E] ml-1"
												})]
											}), /* @__PURE__ */ jsx("span", {
												className: "text-[11px] font-semibold text-white/50",
												children: "Verified Organizer · 4.9 Rating"
											})]
										})]
									})
								]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-10",
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: "bg-[#1C1C1C] rounded-2xl p-4 shadow-sm border border-white/5 flex flex-col items-start justify-center",
										children: [
											/* @__PURE__ */ jsx(Calendar, {
												size: 18,
												className: "text-white/40 mb-2 bg-white/5 p-1.5 rounded-lg box-content"
											}),
											/* @__PURE__ */ jsx("p", {
												className: "text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none mb-1",
												children: "Date"
											}),
											/* @__PURE__ */ jsx("p", {
												className: "font-bold text-white text-sm leading-tight",
												children: formatRelativeDate(gig.event_date)
											})
										]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "bg-[#1C1C1C] rounded-2xl p-4 shadow-sm border border-white/5 flex flex-col items-start justify-center",
										children: [
											/* @__PURE__ */ jsx(Clock, {
												size: 18,
												className: "text-[#00BCD4] mb-2 bg-[#00BCD4]/10 p-1.5 rounded-lg box-content"
											}),
											/* @__PURE__ */ jsx("p", {
												className: "text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none mb-1",
												children: "Duration"
											}),
											/* @__PURE__ */ jsxs("p", {
												className: "font-bold text-white text-sm leading-tight",
												children: [gig.duration_hrs, " Hours"]
											})
										]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "bg-[#1C1C1C] rounded-2xl p-4 shadow-sm border border-white/5 flex flex-col items-start justify-center",
										children: [
											/* @__PURE__ */ jsx(MapPin, {
												size: 18,
												className: "text-[#F4511E] mb-2 bg-[#F4511E]/10 p-1.5 rounded-lg box-content"
											}),
											/* @__PURE__ */ jsx("p", {
												className: "text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none mb-1",
												children: "Location"
											}),
											/* @__PURE__ */ jsx("p", {
												className: "font-bold text-white text-sm leading-tight truncate max-w-full",
												children: gig.location_text.split(",")[0]
											})
										]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "bg-[#1C1C1C] rounded-2xl p-4 shadow-sm border border-white/5 flex flex-col items-start justify-center",
										children: [
											/* @__PURE__ */ jsx(Users, {
												size: 18,
												className: "text-blue-400 mb-2 bg-blue-500/10 p-1.5 rounded-lg box-content"
											}),
											/* @__PURE__ */ jsx("p", {
												className: "text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none mb-1",
												children: "Spots"
											}),
											/* @__PURE__ */ jsxs("p", {
												className: "font-bold text-white text-sm leading-tight",
												children: [Math.max(0, gig.slots_total - (gig.slots_filled || 0)), " Remaining"]
											})
										]
									})
								]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mb-10",
								children: [/* @__PURE__ */ jsx("h3", {
									className: "font-black text-white text-lg mb-4",
									children: "Gig Description"
								}), /* @__PURE__ */ jsx("div", {
									className: "text-white/60 font-medium leading-relaxed space-y-4",
									children: gig.description ? /* @__PURE__ */ jsx("p", { children: gig.description }) : /* @__PURE__ */ jsx("p", {
										className: "italic opacity-60",
										children: "This organizer hasn't added a description yet."
									})
								})]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mb-10",
								children: [/* @__PURE__ */ jsx("h3", {
									className: "font-black text-white text-lg mb-4",
									children: "Location Details"
								}), /* @__PURE__ */ jsxs("div", {
									className: "w-full bg-[#1C1C1C] rounded-[24px] h-[200px] lg:h-[280px] border border-white/5 shadow-sm flex flex-col items-center justify-center relative overflow-hidden group",
									children: [/* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[#111111] opacity-50" }), /* @__PURE__ */ jsxs("div", {
										className: "bg-[#111111]/90 backdrop-blur-sm px-6 py-3 rounded-full flex items-center shadow-lg transform group-hover:scale-105 transition-transform z-10 border border-white/10",
										children: [/* @__PURE__ */ jsx(MapPin, {
											size: 20,
											className: "text-[#F4511E] mr-2"
										}), /* @__PURE__ */ jsx("span", {
											className: "text-white font-bold text-sm tracking-wide",
											children: gig.location_text
										})]
									})]
								})]
							})
						]
					}), /* @__PURE__ */ jsx("div", {
						className: "relative mt-8 lg:mt-0",
						children: /* @__PURE__ */ jsxs("div", {
							className: "lg:sticky lg:top-24",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "bg-[#1C1C1C] rounded-[24px] shadow-xl border border-white/10 overflow-hidden relative",
								children: [/* @__PURE__ */ jsx("div", { className: "absolute top-0 left-0 right-0 h-1.5 bg-[#F4511E]" }), /* @__PURE__ */ jsxs("div", {
									className: "p-6 lg:p-8",
									children: [
										/* @__PURE__ */ jsx("p", {
											className: "text-[10px] font-black text-white/40 uppercase tracking-widest mb-1",
											children: "Total Project Payout"
										}),
										/* @__PURE__ */ jsxs("h2", {
											className: "text-[44px] font-black text-[#F4511E] tracking-tight mb-8 leading-none",
											children: ["₹", payTotal]
										}),
										/* @__PURE__ */ jsx("div", {
											className: "space-y-4 mb-6",
											children: /* @__PURE__ */ jsxs("div", {
												className: "flex justify-between items-center pb-2",
												children: [/* @__PURE__ */ jsxs("span", {
													className: "text-[13px] font-bold text-white/50",
													children: [
														"Hourly Rate (",
														gig.duration_hrs,
														"hrs)"
													]
												}), /* @__PURE__ */ jsxs("span", {
													className: "text-[15px] font-bold text-white",
													children: [
														"₹",
														gig.pay_rate,
														"/hr"
													]
												})]
											})
										}),
										applicationStatus === "pending" || applicationStatus === "accepted" ? /* @__PURE__ */ jsxs("button", {
											type: "button",
											disabled: true,
											className: "w-full h-14 rounded-full font-black text-[15px] flex justify-center items-center bg-white/5 text-white/40 border border-white/10 cursor-not-allowed uppercase tracking-wide",
											children: [/* @__PURE__ */ jsx(Info, {
												size: 18,
												className: "mr-2"
											}), " Pending"]
										}) : applicationStatus === "completed" ? /* @__PURE__ */ jsx("button", {
											type: "button",
											disabled: true,
											className: "w-full h-14 rounded-full font-black text-[15px] bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wide",
											children: "Completed"
										}) : /* @__PURE__ */ jsx("button", {
											type: "button",
											onClick: handleApplyClick,
											disabled: applying || gig.slots_total - (gig.slots_filled || 0) <= 0,
											className: "w-full h-14 rounded-full font-black text-[15px] flex justify-center items-center text-white bg-[#F4511E] hover:bg-[#D84315] transition-all shadow-lg btn-tap disabled:opacity-50 disabled:shadow-none uppercase tracking-wide",
											children: applying ? "Applying..." : "Apply Now"
										}),
										/* @__PURE__ */ jsxs("div", {
											className: "mt-8 space-y-3.5 pt-6 border-t border-white/5 -mx-2 px-2",
											children: [
												/* @__PURE__ */ jsxs("div", {
													className: "flex items-center text-[11px] font-bold text-white/60 uppercase tracking-wide",
													children: [/* @__PURE__ */ jsx(CheckCircle2, {
														size: 16,
														className: "text-[#F4511E] mr-2.5"
													}), " Instant confirmation"]
												}),
												/* @__PURE__ */ jsxs("div", {
													className: "flex items-center text-[11px] font-bold text-white/60 uppercase tracking-wide",
													children: [/* @__PURE__ */ jsx(CheckCircle2, {
														size: 16,
														className: "text-[#F4511E] mr-2.5"
													}), " 1hr payout after completion"]
												}),
												/* @__PURE__ */ jsxs("div", {
													className: "flex items-center text-[11px] font-bold text-white/60 uppercase tracking-wide",
													children: [/* @__PURE__ */ jsx(ShieldCheck, {
														size: 16,
														className: "text-[#F4511E] mr-2.5"
													}), " Verified Gig Guarantee"]
												})
											]
										})
									]
								})]
							}), /* @__PURE__ */ jsxs("div", {
								className: "mt-5 bg-[#1C1C1C] border border-white/5 rounded-2xl p-5",
								children: [
									/* @__PURE__ */ jsx("p", {
										className: "text-[10px] font-black text-white/40 uppercase tracking-widest mb-3",
										children: "Organizer Reputation"
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "grid grid-cols-2 gap-4 mb-4",
										children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
											className: "text-xl font-black text-white mb-0.5",
											children: "142"
										}), /* @__PURE__ */ jsx("p", {
											className: "text-[9px] font-bold text-white/50 tracking-wider uppercase",
											children: "Gigs Hosted"
										})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
											className: "text-xl font-black text-white mb-0.5",
											children: "100%"
										}), /* @__PURE__ */ jsx("p", {
											className: "text-[9px] font-bold text-white/50 tracking-wider uppercase",
											children: "Payment Rate"
										})] })]
									}),
									/* @__PURE__ */ jsxs("button", {
										type: "button",
										className: "text-[#F4511E] text-[11px] font-bold hover:underline flex items-center transition-all btn-tap min-h-[44px]",
										children: ["View Organizer Profile ", /* @__PURE__ */ jsx(ChevronRight, {
											size: 14,
											className: "ml-1"
										})]
									})
								]
							})]
						})
					})]
				})]
			}),
			/* @__PURE__ */ jsx("script", {
				type: "application/ld+json",
				dangerouslySetInnerHTML: { __html: JSON.stringify({
					"@context": "https://schema.org",
					"@type": "JobPosting",
					"title": ssrGig.title,
					"description": ssrGig.description ?? "",
					"datePosted": ssrGig.created_at,
					"validThrough": ssrGig.event_date,
					"employmentType": "TEMPORARY",
					"hiringOrganization": {
						"@type": "Organization",
						"name": "GigDekho",
						"sameAs": "https://gigdekho.com"
					},
					"jobLocation": {
						"@type": "Place",
						"address": {
							"@type": "PostalAddress",
							"addressLocality": ssrGig.location_text,
							"addressRegion": "Madhya Pradesh",
							"addressCountry": "IN"
						}
					},
					"baseSalary": {
						"@type": "MonetaryAmount",
						"currency": "INR",
						"value": {
							"@type": "QuantitativeValue",
							"value": ssrGig.pay_rate,
							"unitText": "HOUR"
						}
					},
					"totalJobOpenings": ssrGig.slots_total - ssrGig.slots_filled,
					"directApply": true
				}) }
			})
		]
	});
});
//#endregion
//#region app/components/TopNav.jsx
function TopNav() {
	const { user, profile, signOut } = useAuth();
	const navigate = useNavigate();
	const [menuOpen, setMenuOpen] = useState(false);
	const dropdownRef = useRef(null);
	useEffect(() => {
		function handleClickOutside(event) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setMenuOpen(false);
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);
	const handleSignOut = () => {
		setMenuOpen(false);
		signOut();
	};
	const handleLogoClick = () => {
		if (user) navigate(profile?.role === "organizer" ? "/organizer/home" : "/worker/home");
		else navigate("/");
	};
	const activeLinkClass = "border-b-2 border-[#F4511E] text-white";
	const defaultLinkClass = "border-b-2 border-transparent text-white/50 hover:text-white";
	return /* @__PURE__ */ jsx("nav", {
		className: "fixed top-0 w-full h-[64px] bg-[#111111] border-b border-white/10 z-50 flex items-center",
		children: /* @__PURE__ */ jsxs("div", {
			className: "w-full px-6 xl:px-12 flex justify-between items-center",
			children: [
				/* @__PURE__ */ jsx("div", {
					className: "text-[22px] tracking-tight flex items-center cursor-pointer hover:opacity-80 transition-opacity",
					onClick: handleLogoClick,
					children: /* @__PURE__ */ jsxs("span", {
						className: "text-white font-bold",
						children: ["Gig", /* @__PURE__ */ jsx("span", {
							className: "text-[#F4511E] italic font-black",
							children: "Dekho"
						})]
					})
				}),
				user && /* @__PURE__ */ jsxs("div", {
					className: "hidden lg:flex space-x-8 items-center h-full absolute left-1/2 -translate-x-1/2",
					children: [
						/* @__PURE__ */ jsx(NavLink, {
							to: "/worker/home",
							end: true,
							className: ({ isActive }) => `text-sm font-bold px-1 py-1 transition-all ${isActive ? activeLinkClass : defaultLinkClass}`,
							children: "Home"
						}),
						/* @__PURE__ */ jsx(NavLink, {
							to: "/worker/dashboard",
							className: ({ isActive }) => `text-sm font-bold px-1 py-1 transition-all ${isActive ? activeLinkClass : defaultLinkClass}`,
							children: "My Gigs"
						}),
						/* @__PURE__ */ jsx(NavLink, {
							to: "/worker/earnings",
							className: ({ isActive }) => `text-sm font-bold px-1 py-1 transition-all ${isActive ? activeLinkClass : defaultLinkClass}`,
							children: "Earnings"
						})
					]
				}),
				/* @__PURE__ */ jsx("div", {
					className: "flex items-center space-x-3",
					children: user ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("button", {
						className: "p-2 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors",
						children: /* @__PURE__ */ jsx(Bell, { size: 18 })
					}), /* @__PURE__ */ jsxs("div", {
						className: "relative",
						ref: dropdownRef,
						children: [/* @__PURE__ */ jsxs("button", {
							onClick: () => setMenuOpen(!menuOpen),
							className: "flex items-center gap-2 pl-1 pr-3 py-1 rounded-full hover:bg-white/10 transition-all",
							children: [/* @__PURE__ */ jsx("div", {
								className: "w-8 h-8 rounded-full bg-[#F4511E] text-white font-black flex items-center justify-center text-sm shadow-sm",
								children: profile?.full_name?.charAt(0) || "W"
							}), /* @__PURE__ */ jsx("span", {
								className: "text-sm font-bold text-white hidden lg:block",
								children: profile?.full_name?.split(" ")[0] || "Worker"
							})]
						}), menuOpen && /* @__PURE__ */ jsxs("div", {
							className: "absolute right-0 mt-2 w-52 bg-[#1C1C1C] border border-white/10 shadow-2xl rounded-xl py-2 animate-in fade-in slide-in-from-top-2",
							children: [
								/* @__PURE__ */ jsxs("div", {
									className: "px-4 py-3 border-b border-white/10 mb-1",
									children: [/* @__PURE__ */ jsx("p", {
										className: "text-sm font-black text-white truncate leading-none mb-0.5",
										children: profile?.full_name || "Worker"
									}), /* @__PURE__ */ jsxs("p", {
										className: "text-[10px] uppercase tracking-wider text-white/40 font-bold",
										children: [profile?.role || "worker", " · Indore"]
									})]
								}),
								/* @__PURE__ */ jsxs("button", {
									type: "button",
									onClick: () => {
										setMenuOpen(false);
										navigate("/worker/profile");
									},
									className: "w-full text-left px-4 py-2.5 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white flex items-center transition-colors",
									children: [/* @__PURE__ */ jsx(User, {
										size: 15,
										className: "mr-2 text-[#F4511E]"
									}), " View Profile"]
								}),
								/* @__PURE__ */ jsxs("button", {
									type: "button",
									onClick: handleSignOut,
									className: "w-full text-left px-4 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center mt-1 transition-colors",
									children: [/* @__PURE__ */ jsx(LogOut, {
										size: 15,
										className: "mr-2"
									}), " Sign Out"]
								})
							]
						})]
					})] }) : /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => navigate("/"),
						className: "hidden lg:block text-white/60 hover:text-white font-bold px-4 py-2 text-[13px] tracking-wide transition-colors",
						children: "Hire Professionals"
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => navigate("/auth"),
						className: "bg-[#F4511E] hover:bg-[#D84315] text-white font-bold px-6 py-2 rounded-full shadow-md transition-all text-[13px] tracking-wide",
						children: "Log in / Sign up"
					})] })
				})
			]
		})
	});
}
//#endregion
//#region app/components/BottomNav.jsx
function BottomNav() {
	return /* @__PURE__ */ jsx("nav", {
		className: "fixed bottom-0 w-full lg:hidden bg-[#111111] border-t border-white/10 px-6 py-2 pb-safe z-50 shadow-[0_-4px_30px_rgba(0,0,0,0.5)]",
		children: /* @__PURE__ */ jsx("div", {
			className: "flex justify-between items-center max-w-2xl mx-auto",
			children: [
				{
					id: "home",
					icon: Home,
					label: "Home",
					path: "/worker/home"
				},
				{
					id: "dashboard",
					icon: Briefcase,
					label: "My Gigs",
					path: "/worker/dashboard"
				},
				{
					id: "earnings",
					icon: Wallet,
					label: "Earnings",
					path: "/worker/earnings"
				},
				{
					id: "profile",
					icon: User,
					label: "Profile",
					path: "/worker/profile"
				}
			].map((item) => {
				const Icon = item.icon;
				return /* @__PURE__ */ jsx(NavLink, {
					to: item.path,
					end: item.path === "/worker/home",
					className: ({ isActive }) => `flex flex-col items-center justify-center min-w-[64px] min-h-[44px] transition-all btn-tap ${isActive ? "text-[#F4511E]" : "text-white/30 hover:text-white/60"}`,
					children: ({ isActive }) => /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
						className: `p-1.5 rounded-xl transition-colors ${isActive ? "bg-[#F4511E]/15" : "bg-transparent"}`,
						children: /* @__PURE__ */ jsx(Icon, {
							size: 22,
							strokeWidth: isActive ? 2.5 : 1.8
						})
					}), /* @__PURE__ */ jsx("span", {
						className: `text-[10px] mt-0.5 font-bold`,
						children: item.label
					})] })
				}, item.id);
			})
		})
	});
}
//#endregion
//#region app/components/Footer.jsx
function Footer() {
	return /* @__PURE__ */ jsx("footer", {
		className: "bg-[#0A0A0A] border-t border-white/5 pt-16 pb-28 lg:pb-12 text-white/60 font-sans",
		children: /* @__PURE__ */ jsxs("div", {
			className: "max-w-7xl mx-auto px-6 lg:px-12",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 mb-16",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "space-y-6",
						children: [
							/* @__PURE__ */ jsxs("h2", {
								className: "text-2xl font-black text-white tracking-tight",
								children: ["GigDekho", /* @__PURE__ */ jsx("span", {
									className: "text-[#F4511E]",
									children: "."
								})]
							}),
							/* @__PURE__ */ jsx("p", {
								className: "text-sm font-medium leading-relaxed max-w-sm",
								children: "Connecting local businesses with verified, high-quality event professionals in Indore. Flexible work, instant payouts, zero hassle."
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "flex space-x-4",
								children: [
									/* @__PURE__ */ jsx("a", {
										href: "#",
										className: "text-sm font-bold text-white/60 hover:text-[#F4511E] transition-colors",
										children: "Instagram"
									}),
									/* @__PURE__ */ jsx("a", {
										href: "#",
										className: "text-sm font-bold text-white/60 hover:text-[#F4511E] transition-colors",
										children: "LinkedIn"
									}),
									/* @__PURE__ */ jsx("a", {
										href: "#",
										className: "text-sm font-bold text-white/60 hover:text-[#F4511E] transition-colors",
										children: "Twitter"
									})
								]
							})
						]
					}),
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
						className: "text-white font-bold mb-6",
						children: "Quick Links"
					}), /* @__PURE__ */ jsxs("ul", {
						className: "space-y-4 text-sm font-medium",
						children: [
							/* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(Link, {
								to: "/worker/home",
								className: "hover:text-[#F4511E] transition-colors",
								children: "Browse Gigs"
							}) }),
							/* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(Link, {
								to: "/auth",
								className: "hover:text-[#F4511E] transition-colors",
								children: "Join as Worker"
							}) }),
							/* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(Link, {
								to: "/auth",
								className: "hover:text-[#F4511E] transition-colors",
								children: "Hire Professionals"
							}) }),
							/* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("a", {
								href: "#",
								className: "hover:text-[#F4511E] transition-colors",
								children: "About Us"
							}) })
						]
					})] }),
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
						className: "text-white font-bold mb-6",
						children: "Support"
					}), /* @__PURE__ */ jsxs("ul", {
						className: "space-y-4 text-sm font-medium",
						children: [
							/* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("a", {
								href: "#",
								className: "hover:text-[#F4511E] transition-colors",
								children: "FAQ"
							}) }),
							/* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("a", {
								href: "#",
								className: "hover:text-[#F4511E] transition-colors",
								children: "Trust & Safety"
							}) }),
							/* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("a", {
								href: "#",
								className: "hover:text-[#F4511E] transition-colors",
								children: "Terms of Service"
							}) }),
							/* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("a", {
								href: "#",
								className: "hover:text-[#F4511E] transition-colors",
								children: "Privacy Policy"
							}) })
						]
					})] }),
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
						className: "text-white font-bold mb-6",
						children: "Contact Us"
					}), /* @__PURE__ */ jsxs("ul", {
						className: "space-y-4 text-sm font-medium",
						children: [
							/* @__PURE__ */ jsxs("li", {
								className: "flex items-start",
								children: [/* @__PURE__ */ jsx(Phone, {
									size: 18,
									className: "mr-3 text-[#F4511E] shrink-0 mt-0.5"
								}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("a", {
									href: "tel:+918423313611",
									className: "block hover:text-white transition-colors",
									children: "+91 84233 13611"
								}), /* @__PURE__ */ jsx("a", {
									href: "tel:+919827010006",
									className: "block hover:text-white transition-colors mt-1",
									children: "+91 98270 10006"
								})] })]
							}),
							/* @__PURE__ */ jsxs("li", {
								className: "flex items-start",
								children: [/* @__PURE__ */ jsx(Mail, {
									size: 18,
									className: "mr-3 text-[#F4511E] shrink-0 mt-0.5"
								}), /* @__PURE__ */ jsxs("div", {
									className: "break-all",
									children: [/* @__PURE__ */ jsx("a", {
										href: "mailto:foundersyc@gmail.com",
										className: "block hover:text-white transition-colors",
										children: "foundersyc@gmail.com"
									}), /* @__PURE__ */ jsx("a", {
										href: "mailto:yashupadhyaywork01@gmail.com",
										className: "block hover:text-white transition-colors mt-1",
										children: "yashupadhyaywork01@gmail.com"
									})]
								})]
							}),
							/* @__PURE__ */ jsxs("li", {
								className: "flex items-start",
								children: [/* @__PURE__ */ jsx(MapPin, {
									size: 18,
									className: "mr-3 text-[#F4511E] shrink-0 mt-0.5"
								}), /* @__PURE__ */ jsxs("span", { children: [
									"Indore, Madhya Pradesh",
									/* @__PURE__ */ jsx("br", {}),
									"India"
								] })]
							})
						]
					})] })
				]
			}), /* @__PURE__ */ jsxs("div", {
				className: "border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center text-xs font-medium",
				children: [/* @__PURE__ */ jsxs("p", { children: [
					"© ",
					(/* @__PURE__ */ new Date()).getFullYear(),
					" GigDekho Technologies. All rights reserved."
				] }), /* @__PURE__ */ jsx("p", {
					className: "mt-2 md:mt-0",
					children: "Made with ❤️ in Indore"
				})]
			})]
		})
	});
}
//#endregion
//#region app/routes/public-layout.tsx
var public_layout_exports = /* @__PURE__ */ __exportAll({ default: () => public_layout_default });
var public_layout_default = UNSAFE_withComponentProps(function PublicLayout() {
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsx(TopNav, {}),
		/* @__PURE__ */ jsx("main", {
			id: "main-content",
			className: "min-h-screen pt-[64px] pb-24 lg:pb-0",
			children: /* @__PURE__ */ jsx(Outlet, {})
		}),
		/* @__PURE__ */ jsx(BottomNav, {}),
		/* @__PURE__ */ jsx(Footer, {})
	] });
});
//#endregion
//#region app/components/GigCard.jsx
var getImageUrl$1 = (role) => {
	const r = (role || "").toLowerCase();
	let url = "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400";
	if (r.includes("wait") || r.includes("hostess")) url = "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400";
	else if (r.includes("sing") || r.includes("vocal")) url = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400";
	else if (r.includes("dj") || r.includes("disc")) url = "https://images.unsplash.com/photo-1571266028243-d220c6f3f07b?w=400";
	else if (r.includes("art") || r.includes("sketch")) url = "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400";
	else if (r.includes("secur") || r.includes("guard") || r.includes("bouncer")) url = "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400";
	else if (r.includes("danc")) url = "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=400";
	else if (r.includes("photo") || r.includes("camera")) url = "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=400";
	return url + "&auto=format&fit=crop";
};
function GigCard({ gig, onClick }) {
	const { title, role_type, location_text, pay_rate, duration_hrs, event_date, is_urgent, slots_total, slots_filled } = gig;
	const totalEarning = pay_rate * duration_hrs;
	const remainingSpots = (slots_total || 0) - (slots_filled || 0);
	const dateFormatted = formatRelativeDate(event_date);
	return /* @__PURE__ */ jsxs("div", {
		onClick,
		className: `bg-[#1C1C1C] rounded-3xl shadow-sm hover:shadow-md border border-white/5 overflow-hidden cursor-pointer transition-all mb-4 btn-tap flex flex-col p-4 w-full`,
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "relative h-48 w-full bg-slate-900 rounded-2xl overflow-hidden mb-4",
				children: [
					/* @__PURE__ */ jsx("img", {
						src: getImageUrl$1(role_type),
						alt: role_type,
						loading: "lazy",
						decoding: "async",
						className: "w-full h-full object-cover opacity-80"
					}),
					/* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-[#111111]/90 via-black/20 to-transparent" }),
					/* @__PURE__ */ jsxs("div", {
						className: "absolute top-4 left-4 flex gap-2",
						children: [is_urgent ? /* @__PURE__ */ jsxs("span", {
							className: "bg-[#F4511E] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg flex items-center",
							children: [/* @__PURE__ */ jsx(Zap, {
								size: 10,
								className: "mr-1",
								fill: "currentColor"
							}), " URGENT"]
						}) : null, !is_urgent && /* @__PURE__ */ jsx("span", {
							className: "bg-white/10 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm border border-white/20",
							children: "FEATURED"
						})]
					}),
					remainingSpots > 0 && /* @__PURE__ */ jsxs("div", {
						className: "absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md border border-white/10",
						children: [
							remainingSpots,
							" spot",
							remainingSpots !== 1 ? "s" : "",
							" left"
						]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex justify-between items-start mb-2 px-1",
				children: [/* @__PURE__ */ jsx("h3", {
					className: "text-lg font-black text-white leading-tight",
					children: title
				}), /* @__PURE__ */ jsxs("span", {
					className: "text-lg font-black text-[#F4511E] drop-shadow-sm ml-4",
					children: ["₹", totalEarning.toLocaleString("en-IN")]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center text-white/50 text-xs font-bold px-1 mb-5 flex-wrap gap-y-2",
				children: [
					/* @__PURE__ */ jsx(Calendar, {
						size: 12,
						className: "mr-1 shrink-0"
					}),
					/* @__PURE__ */ jsx("span", {
						className: "mr-2 text-[#F4511E]",
						children: dateFormatted
					}),
					/* @__PURE__ */ jsx("span", {
						className: "mr-2 text-white/20 hidden sm:inline",
						children: "•"
					}),
					/* @__PURE__ */ jsx(MapPin, {
						size: 12,
						className: "mr-1 shrink-0 lg:ml-0 md:ml-0 sm:ml-0"
					}),
					/* @__PURE__ */ jsx("span", {
						className: "mr-2 truncate max-w-[120px]",
						children: location_text
					}),
					/* @__PURE__ */ jsx("span", {
						className: "mr-2 text-white/20",
						children: "•"
					}),
					/* @__PURE__ */ jsx(Clock, {
						size: 12,
						className: "mr-1 shrink-0"
					}),
					/* @__PURE__ */ jsxs("span", { children: [duration_hrs, "h"] })
				]
			}),
			is_urgent ? /* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: (e) => {
					e.stopPropagation();
					onClick();
				},
				className: "w-full bg-[#F4511E] hover:bg-[#D84315] text-white font-black py-3.5 rounded-2xl text-[14px] transition-colors shadow-sm btn-tap",
				children: "Apply Now"
			}) : /* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: (e) => {
					e.stopPropagation();
					onClick();
				},
				className: "w-full bg-transparent border-2 border-white/10 hover:border-white/20 hover:bg-white/5 text-white/80 font-black py-3 rounded-2xl text-[14px] transition-colors btn-tap",
				children: "View Details"
			})
		]
	});
}
//#endregion
//#region app/routes/worker.home.tsx
var worker_home_exports = /* @__PURE__ */ __exportAll({ default: () => worker_home_default });
var worker_home_default = UNSAFE_withComponentProps(function HomeScreen() {
	const [gigs, setGigs] = useState([]);
	const [trendingGigs, setTrendingGigs] = useState([]);
	const [stats, setStats] = useState({
		live: 0,
		topPay: 0,
		hiredToday: 0,
		sumToday: 0
	});
	const [userStats, setUserStats] = useState({
		done: 0,
		rating: 4.9
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [selectedRole, setSelectedRole] = useState("All Roles");
	const [showHowItWorks, setShowHowItWorks] = useState(false);
	const { user, profile } = useAuth();
	const navigate = useNavigate();
	console.log("HomeScreen Render:", {
		user: user?.id,
		profile: !!profile,
		loading
	});
	const roleCategories = [
		{
			id: "All Roles",
			icon: "🎯"
		},
		{
			id: "Waitstaff",
			icon: "🍽️"
		},
		{
			id: "Artist",
			icon: "🎨"
		},
		{
			id: "Singer",
			icon: "🎤"
		},
		{
			id: "Security",
			icon: "🛡️"
		},
		{
			id: "Promoter",
			icon: "🔥"
		},
		{
			id: "Hostess",
			icon: "✨"
		},
		{
			id: "DJ",
			icon: "🎧"
		},
		{
			id: "Dancer",
			icon: "💃"
		},
		{
			id: "Photographer",
			icon: "📸"
		}
	];
	useEffect(() => {
		console.log("HomeScreen mount: fetching general gig data");
		fetchData();
	}, []);
	useEffect(() => {
		console.log("HomeScreen fetchUserStats useEffect triggered:", {
			user: user?.id,
			profile: !!profile
		});
		const fetchUserStats = async () => {
			if (!user) return;
			try {
				console.log("fetchUserStats running query");
				const { count: completedCount } = await (void 0).from("applications").select("*", {
					count: "exact",
					head: true
				}).eq("worker_id", user.id).eq("status", "completed");
				setUserStats({
					done: completedCount || 0,
					rating: profile?.avg_rating || 4.9
				});
			} catch (err) {
				console.error("Fetch user stats error:", err);
			}
		};
		fetchUserStats();
	}, [user, profile]);
	const fetchData = async () => {
		setLoading(true);
		setError("");
		try {
			const { data: gigsData, error: fetchError } = await (void 0).from("gigs").select("*").eq("status", "open").gt("event_date", (/* @__PURE__ */ new Date()).toISOString()).order("is_urgent", { ascending: false }).order("event_date", { ascending: true });
			if (fetchError) throw fetchError;
			setGigs(gigsData || []);
			const { count: liveCount } = await (void 0).from("gigs").select("*", {
				count: "exact",
				head: true
			}).eq("status", "open").gt("event_date", (/* @__PURE__ */ new Date()).toISOString());
			const { data: topPayData } = await (void 0).from("gigs").select("pay_rate").eq("status", "open").order("pay_rate", { ascending: false }).limit(1);
			const { count: hiredCount } = await (void 0).from("applications").select("*", {
				count: "exact",
				head: true
			}).gte("applied_at", (/* @__PURE__ */ new Date()).toDateString());
			const { data: trendingData } = await (void 0).from("gigs").select("*").eq("status", "open").order("slots_filled", { ascending: false }).limit(3);
			setTrendingGigs(trendingData || []);
			const totalSum = (gigsData || []).reduce((acc, gig) => acc + gig.pay_rate * gig.duration_hrs, 0);
			setStats({
				live: liveCount || 0,
				topPay: topPayData?.[0]?.pay_rate || 0,
				hiredToday: hiredCount || 0,
				sumToday: totalSum
			});
		} catch (err) {
			console.error("Fetch error:", err);
			setError("Something went wrong. Try again.");
		} finally {
			setLoading(false);
		}
	};
	const filteredGigs = gigs.filter((gig) => {
		if (selectedRole !== "All Roles") {
			if (!gig.role_type) return false;
			return gig.role_type.toLowerCase().includes(selectedRole.toLowerCase());
		}
		return true;
	});
	return /* @__PURE__ */ jsxs("main", {
		id: "main-content",
		className: "pb-24 lg:pb-12 bg-background min-h-screen",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "relative w-full pt-20 lg:pt-32 pb-32 lg:pb-48 hero-gradient-overlay flex flex-col items-center justify-center text-center px-4 overflow-hidden",
				children: [
					/* @__PURE__ */ jsx("div", { className: "absolute top-10 left-[15%] w-[250px] h-[500px] floating-glass-rect -rotate-12 z-0 hidden lg:block opacity-60" }),
					/* @__PURE__ */ jsx("div", { className: "absolute top-20 right-[15%] w-[300px] h-[600px] floating-glass-rect rotate-12 z-0 hidden lg:block opacity-60" }),
					/* @__PURE__ */ jsxs("div", {
						className: "relative z-10 max-w-4xl mx-auto w-full",
						children: [
							/* @__PURE__ */ jsxs("h1", {
								className: "text-5xl lg:text-[80px] font-black text-white leading-tight mb-4 tracking-tighter drop-shadow-md",
								children: [
									"Earn ",
									/* @__PURE__ */ jsxs("span", {
										className: "text-[#00e5ff]",
										children: ["₹", stats.sumToday.toLocaleString("en-IN")]
									}),
									" today"
								]
							}),
							/* @__PURE__ */ jsxs("p", {
								className: "text-white/90 font-medium text-lg lg:text-xl mb-10 max-w-2xl mx-auto leading-relaxed",
								children: [stats.live, " gigs live right now. Participate, volunteer and earn through events in Indore!"]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-10",
								children: [/* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: () => document.getElementById("available-jobs")?.scrollIntoView({ behavior: "smooth" }),
									className: "bg-[#F4511E] hover:bg-[#D84315] text-white font-bold px-8 py-3.5 rounded-full shadow-lg transition-all btn-tap w-full sm:w-auto",
									children: "Browse Gigs"
								}), /* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: () => setShowHowItWorks(true),
									className: "border border-white/30 hover:bg-white hover:text-[#111111] text-white font-bold px-8 py-3.5 rounded-full glass-panel shadow-sm transition-all btn-tap w-full sm:w-auto",
									children: "How it works"
								})]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 max-w-4xl mx-auto",
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: "glass-panel p-4 rounded-2xl flex flex-col items-center justify-center text-center",
										children: [/* @__PURE__ */ jsx("span", {
											className: "text-white/60 text-[10px] uppercase font-black tracking-widest mb-1",
											children: "Live Gigs"
										}), /* @__PURE__ */ jsx("span", {
											className: "text-2xl font-black text-white tracking-tight",
											children: stats.live
										})]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "glass-panel p-4 rounded-2xl flex flex-col items-center justify-center text-center",
										children: [/* @__PURE__ */ jsx("span", {
											className: "text-white/60 text-[10px] uppercase font-black tracking-widest mb-1",
											children: "Top Pay"
										}), /* @__PURE__ */ jsxs("span", {
											className: "text-2xl font-black text-[#F4511E] tracking-tight",
											children: ["₹", stats.topPay >= 1e3 ? (stats.topPay / 1e3).toFixed(1) + "k" : stats.topPay]
										})]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "glass-panel p-4 rounded-2xl flex flex-col items-center justify-center text-center",
										children: [/* @__PURE__ */ jsx("span", {
											className: "text-white/60 text-[10px] uppercase font-black tracking-widest mb-1",
											children: "Hired Today"
										}), /* @__PURE__ */ jsx("span", {
											className: "text-2xl font-black text-white tracking-tight",
											children: stats.hiredToday
										})]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "glass-panel p-4 rounded-2xl flex flex-col items-center justify-center text-center",
										children: [/* @__PURE__ */ jsx("span", {
											className: "text-white/60 text-[10px] uppercase font-black tracking-widest mb-1",
											children: "Payout"
										}), /* @__PURE__ */ jsx("span", {
											className: "text-2xl font-black text-white tracking-tight",
											children: "1hr"
										})]
									})
								]
							})
						]
					})
				]
			}),
			showHowItWorks && /* @__PURE__ */ jsx("div", {
				className: "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200",
				onClick: () => setShowHowItWorks(false),
				children: /* @__PURE__ */ jsxs("div", {
					className: "bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative",
					onClick: (e) => e.stopPropagation(),
					children: [
						/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => setShowHowItWorks(false),
							className: "absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 font-bold",
							children: "✕"
						}),
						/* @__PURE__ */ jsx("h3", {
							className: "text-2xl font-black text-slate-900 mb-6",
							children: "How it works"
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "space-y-6",
							children: [
								/* @__PURE__ */ jsxs("div", {
									className: "flex items-start",
									children: [/* @__PURE__ */ jsx("div", {
										className: "w-8 h-8 rounded-full bg-cyan-100 text-[#00BCD4] font-black flex items-center justify-center shrink-0 mr-4",
										children: "1"
									}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
										className: "font-bold text-slate-800",
										children: "Browse gigs near you"
									}), /* @__PURE__ */ jsx("p", {
										className: "text-xs text-slate-500 font-medium",
										children: "Find verified local events."
									})] })]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "flex items-start",
									children: [/* @__PURE__ */ jsx("div", {
										className: "w-8 h-8 rounded-full bg-cyan-100 text-[#00BCD4] font-black flex items-center justify-center shrink-0 mr-4",
										children: "2"
									}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
										className: "font-bold text-slate-800",
										children: "Apply in one tap"
									}), /* @__PURE__ */ jsx("p", {
										className: "text-xs text-slate-500 font-medium",
										children: "Zero friction application."
									})] })]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "flex items-start",
									children: [/* @__PURE__ */ jsx("div", {
										className: "w-8 h-8 rounded-full bg-cyan-100 text-[#00BCD4] font-black flex items-center justify-center shrink-0 mr-4",
										children: "3"
									}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
										className: "font-bold text-slate-800",
										children: "Show up and get paid"
									}), /* @__PURE__ */ jsx("p", {
										className: "text-xs text-slate-500 font-medium",
										children: "Earn within 1 hour after completion."
									})] })]
								})
							]
						})
					]
				})
			}),
			/* @__PURE__ */ jsx("div", {
				className: "px-4 xl:px-12 w-full mx-auto relative z-20 -mt-16 lg:-mt-24 mb-12",
				children: /* @__PURE__ */ jsx("div", {
					className: "bg-[#1C1C1C]/80 backdrop-blur-xl border border-white/10 shadow-lg rounded-full p-2 flex space-x-1 overflow-x-auto category-strip max-w-6xl mx-auto items-center",
					children: roleCategories.map((cat) => /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setSelectedRole(cat.id),
						className: `flex items-center px-6 lg:px-8 py-3 rounded-full text-[13px] font-bold whitespace-nowrap transition-all flex-shrink-0 ${selectedRole === cat.id ? "bg-[#F4511E] text-white shadow-md" : "text-white/60 hover:bg-white/5 hover:text-white"}`,
						children: cat.id === "All Roles" ? "All" : cat.id
					}, cat.id))
				})
			}),
			/* @__PURE__ */ jsx("div", {
				className: "px-4 xl:px-12 w-full mx-auto",
				children: /* @__PURE__ */ jsxs("div", {
					className: "lg:grid lg:grid-cols-[65%_35%] lg:gap-10 items-start pb-12",
					children: [/* @__PURE__ */ jsxs("section", {
						"aria-label": "Available Gigs",
						className: "w-full",
						id: "available-jobs",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "mb-6 lg:mb-8 flex justify-between items-start",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "flex flex-col",
									children: [/* @__PURE__ */ jsx("h2", {
										className: "text-2xl font-black text-white tracking-tight mb-1",
										children: "Available Jobs"
									}), /* @__PURE__ */ jsx("p", {
										className: "text-[13px] font-medium text-white/50",
										children: "Handpicked gigs in Indore based on your profile"
									})]
								}), /* @__PURE__ */ jsxs("div", {
									className: "flex space-x-2",
									children: [/* @__PURE__ */ jsx("button", {
										type: "button",
										className: "bg-[#1C1C1C] hover:bg-white/10 p-2 rounded-full text-white/70 transition-colors shadow-sm border border-white/5",
										children: /* @__PURE__ */ jsx(SlidersHorizontal, { size: 18 })
									}), /* @__PURE__ */ jsx("button", {
										type: "button",
										className: "bg-[#1C1C1C] hover:bg-white/10 p-2 rounded-full text-white/70 transition-colors shadow-sm border border-white/5",
										children: /* @__PURE__ */ jsx(ArrowDownAZ, { size: 18 })
									})]
								})]
							}),
							error && /* @__PURE__ */ jsxs("div", {
								className: "bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border border-red-100 mb-4 flex justify-between items-center",
								children: [/* @__PURE__ */ jsx("span", { children: error }), /* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: fetchData,
									className: "underline text-red-700",
									children: "Retry"
								})]
							}),
							loading && /* @__PURE__ */ jsx("div", {
								className: "space-y-4 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0",
								children: [
									1,
									2,
									3,
									4
								].map((i) => /* @__PURE__ */ jsxs("div", {
									className: "bg-[#1C1C1C] rounded-2xl p-5 lg:p-6 shadow-sm border border-white/5 animate-pulse",
									children: [
										/* @__PURE__ */ jsx("div", { className: "h-4 bg-white/10 rounded w-1/4 mb-3" }),
										/* @__PURE__ */ jsx("div", { className: "h-6 bg-white/10 rounded w-3/4 mb-4" }),
										/* @__PURE__ */ jsxs("div", {
											className: "flex justify-between",
											children: [/* @__PURE__ */ jsx("div", { className: "h-8 bg-white/10 rounded w-1/3" }), /* @__PURE__ */ jsx("div", { className: "h-8 bg-white/10 rounded w-1/4" })]
										})
									]
								}, i))
							}),
							!loading && filteredGigs.length === 0 && !error && /* @__PURE__ */ jsxs("div", {
								className: "bg-[#1C1C1C] border border-white/5 rounded-2xl p-8 lg:p-16 flex flex-col items-center justify-center text-center mt-6",
								children: [
									/* @__PURE__ */ jsx("div", {
										className: "w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-5 text-[#F4511E]",
										children: /* @__PURE__ */ jsx(Briefcase, { size: 36 })
									}),
									/* @__PURE__ */ jsx("p", {
										className: "text-white/60 font-medium mb-5",
										children: "No gigs right now — check back in a bit."
									}),
									/* @__PURE__ */ jsxs("button", {
										type: "button",
										onClick: fetchData,
										className: "flex items-center justify-center bg-[#F4511E] text-white px-5 py-2.5 rounded-xl font-bold min-h-[44px] text-sm shadow-sm hover:bg-[#D84315] transition-colors btn-tap",
										children: [/* @__PURE__ */ jsx(RefreshCw, {
											size: 16,
											className: "mr-2"
										}), " Refresh"]
									})
								]
							}),
							!loading && filteredGigs.length > 0 && /* @__PURE__ */ jsx("div", {
								className: "space-y-4 md:grid md:grid-cols-2 md:gap-5 md:space-y-0 lg:grid-cols-2",
								children: filteredGigs.map((gig) => /* @__PURE__ */ jsx(GigCard, {
									gig,
									onClick: () => navigate(`/gigs/${gig.id}`)
								}, gig.id))
							})
						]
					}), /* @__PURE__ */ jsxs("div", {
						className: "hidden lg:block sticky top-24 space-y-6",
						children: [
							user && /* @__PURE__ */ jsxs("div", {
								className: "bg-[#1C1C1C] rounded-3xl p-6 shadow-sm border border-white/5 flex flex-col items-start relative",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "flex items-center mb-6",
									children: [/* @__PURE__ */ jsx("div", {
										className: "w-10 h-10 bg-[#F4511E]/10 rounded-full flex items-center justify-center text-[#F4511E] mr-4 border border-[#F4511E]/20 shadow-sm",
										children: /* @__PURE__ */ jsx(Zap, {
											size: 20,
											fill: "currentColor"
										})
									}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
										className: "font-extrabold text-white text-[15px] leading-tight",
										children: "Your Activity"
									}), /* @__PURE__ */ jsx("span", {
										className: "text-[10px] font-black text-white/40 uppercase tracking-widest",
										children: "Worker Performance"
									})] })]
								}), /* @__PURE__ */ jsxs("div", {
									className: "grid grid-cols-2 gap-4 w-full",
									children: [/* @__PURE__ */ jsxs("div", {
										className: "bg-[#111111] rounded-2xl py-4 flex flex-col items-center justify-center shadow-sm border border-white/5",
										children: [/* @__PURE__ */ jsx("p", {
											className: "text-[9px] font-black text-white/40 uppercase tracking-widest mb-1 leading-none",
											children: "Gigs Done"
										}), /* @__PURE__ */ jsx("p", {
											className: "text-2xl font-black text-white leading-none tracking-tight",
											children: userStats.done
										})]
									}), /* @__PURE__ */ jsxs("div", {
										className: "bg-[#111111] rounded-2xl py-4 flex flex-col items-center justify-center shadow-sm border border-white/5 relative",
										children: [/* @__PURE__ */ jsx("p", {
											className: "text-[9px] font-black text-white/40 uppercase tracking-widest mb-1 leading-none",
											children: "Rating"
										}), /* @__PURE__ */ jsx("p", {
											className: "text-2xl font-black text-[#F4511E] leading-none tracking-tight",
											children: userStats.rating
										})]
									})]
								})]
							}),
							trendingGigs.length > 0 && /* @__PURE__ */ jsxs("div", {
								className: "bg-[#1C1C1C] rounded-3xl shadow-sm border border-white/5 py-6",
								children: [/* @__PURE__ */ jsx("h3", {
									className: "font-extrabold text-white px-6 mb-6 tracking-tight text-[17px]",
									children: "Trending Now"
								}), /* @__PURE__ */ jsx("div", {
									className: "space-y-5 mt-2 px-6",
									children: trendingGigs.map((trend, i) => /* @__PURE__ */ jsxs("div", {
										className: `flex items-start ${i > 0 && "border-t border-white/5 pt-5"}`,
										children: [/* @__PURE__ */ jsx("div", {
											className: `w-9 h-9 rounded-full flex items-center justify-center mr-4 border shrink-0 ${i === 0 ? "bg-orange-500/10 text-orange-500 border-orange-500/20" : i === 1 ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" : "bg-purple-500/10 text-purple-400 border-purple-500/20"}`,
											children: /* @__PURE__ */ jsx(Star, {
												size: 16,
												fill: "none",
												strokeWidth: 3
											})
										}), /* @__PURE__ */ jsxs("div", {
											className: "cursor-pointer hover:underline",
											onClick: () => navigate(`/gigs/${trend.id}`),
											children: [/* @__PURE__ */ jsx("p", {
												className: "font-bold text-white text-sm leading-tight line-clamp-1",
												children: trend.title
											}), /* @__PURE__ */ jsxs("p", {
												className: "text-white/40 font-bold text-[11px] mt-0.5",
												children: [trend.slots_filled || 0, "+ applications in last hour"]
											})]
										})]
									}, trend.id))
								})]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "bg-gradient-to-br from-[#6231d4] to-[#4510b6] rounded-3xl p-6 relative overflow-hidden shadow-lg border border-[#7d4de2]",
								children: [
									/* @__PURE__ */ jsx("div", {
										className: "absolute right-[-30px] bottom-[-30px] opacity-20",
										children: /* @__PURE__ */ jsx(Users, {
											size: 140,
											className: "text-white"
										})
									}),
									/* @__PURE__ */ jsx("h3", {
										className: "font-black text-white text-lg mb-2 relative z-10 tracking-tight",
										children: "Refer a Friend"
									}),
									/* @__PURE__ */ jsx("p", {
										className: "text-[13px] font-medium text-white/80 mb-6 leading-relaxed relative z-10 max-w-[200px]",
										children: "Get ₹500 for every professional you invite."
									}),
									/* @__PURE__ */ jsx("button", {
										type: "button",
										className: "bg-white hover:bg-slate-50 text-[#6231d4] font-bold py-2.5 px-6 text-sm rounded-full transition-colors shadow-sm btn-tap relative z-10",
										children: "Get Invite Link"
									})
								]
							})
						]
					})]
				})
			})
		]
	});
});
//#endregion
//#region app/components/ProtectedRoute.jsx
var Spinner = () => /* @__PURE__ */ jsx("div", {
	className: "min-h-screen flex items-center justify-center bg-[#111111]",
	children: /* @__PURE__ */ jsx("div", { className: "w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" })
});
function ProtectedRoute({ children }) {
	const { user, profile, loading } = useAuth();
	const location = useLocation();
	const navigate = useNavigate();
	console.log("ProtectedRoute Render:", {
		user: user?.id,
		profile: !!profile,
		loading,
		path: location.pathname
	});
	const isWorkerRoute = location.pathname.startsWith("/worker/");
	const isOrganizerRoute = location.pathname.startsWith("/organizer/");
	const isPublicRoute = location.pathname === "/worker/home";
	useEffect(() => {
		if (loading || isPublicRoute) return;
		if (!user) {
			navigate("/auth", {
				state: { from: location },
				replace: true
			});
			return;
		}
		if (!profile?.full_name && location.pathname !== "/setup-profile") {
			navigate("/setup-profile", { replace: true });
			return;
		}
		if (profile?.role === "organizer" && isWorkerRoute) {
			navigate("/organizer/home", { replace: true });
			return;
		}
		if (profile?.role === "worker" && isOrganizerRoute) navigate("/worker/home", { replace: true });
	}, [
		loading,
		user,
		profile,
		location,
		navigate,
		isWorkerRoute,
		isOrganizerRoute,
		isPublicRoute
	]);
	if (loading) return /* @__PURE__ */ jsx(Spinner, {});
	if (isPublicRoute) return children;
	if (!user) return /* @__PURE__ */ jsx(Spinner, {});
	if (!profile?.full_name && location.pathname !== "/setup-profile") return /* @__PURE__ */ jsx(Spinner, {});
	if (profile?.role === "organizer" && isWorkerRoute) return /* @__PURE__ */ jsx(Spinner, {});
	if (profile?.role === "worker" && isOrganizerRoute) return /* @__PURE__ */ jsx(Spinner, {});
	return children;
}
//#endregion
//#region app/routes/app-layout.tsx
var app_layout_exports = /* @__PURE__ */ __exportAll({ default: () => app_layout_default });
var app_layout_default = UNSAFE_withComponentProps(function AppLayout() {
	return /* @__PURE__ */ jsx(ProtectedRoute, { children: /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col min-h-screen",
		children: [
			/* @__PURE__ */ jsx(TopNav, {}),
			/* @__PURE__ */ jsx("main", {
				id: "main-content",
				className: "flex-grow pt-[64px] pb-24 lg:pb-0",
				children: /* @__PURE__ */ jsx(Outlet, {})
			}),
			/* @__PURE__ */ jsx(BottomNav, {}),
			/* @__PURE__ */ jsx(Footer, {})
		]
	}) });
});
//#endregion
//#region app/routes/worker.dashboard.tsx
var worker_dashboard_exports = /* @__PURE__ */ __exportAll({ default: () => worker_dashboard_default });
var getImageUrl = (role) => {
	const r = (role || "").toLowerCase();
	let url = "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400";
	if (r.includes("wait") || r.includes("hostess")) url = "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400";
	else if (r.includes("sing") || r.includes("vocal")) url = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400";
	else if (r.includes("dj") || r.includes("disc")) url = "https://images.unsplash.com/photo-1571266028243-d220c6f3f07b?w=400";
	else if (r.includes("art") || r.includes("sketch")) url = "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400";
	else if (r.includes("secur") || r.includes("guard") || r.includes("bouncer")) url = "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400";
	else if (r.includes("danc")) url = "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=400";
	else if (r.includes("photo") || r.includes("camera")) url = "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=400";
	return url + "&auto=format&fit=crop";
};
var worker_dashboard_default = UNSAFE_withComponentProps(function DashboardScreen() {
	const [tab, setTab] = useState("active");
	const [apps, setApps] = useState([]);
	const [loading, setLoading] = useState(true);
	const { user } = useAuth();
	const navigate = useNavigate();
	useEffect(() => {
		if (user) fetchApplications();
	}, [user]);
	const fetchApplications = async () => {
		setLoading(true);
		try {
			const { data, error } = await (void 0).from("applications").select(`*, gig:gigs(*)`).eq("worker_id", user.id).order("applied_at", { ascending: false });
			if (error) throw error;
			setApps(data || []);
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	};
	const getStatusParams = (status) => {
		switch (status) {
			case "pending": return {
				label: "Pending",
				color: "bg-orange-100 text-orange-700 border-orange-200"
			};
			case "accepted": return {
				label: "Accepted",
				color: "bg-green-100 text-green-700 border-green-200"
			};
			case "completed": return {
				label: "Completed",
				color: "bg-slate-100 text-slate-700 border-slate-200"
			};
			case "no_show": return {
				label: "No Show",
				color: "bg-red-100 text-red-700 border-red-200"
			};
			default: return {
				label: status,
				color: "bg-slate-100 text-slate-700 border-slate-200"
			};
		}
	};
	const filteredApps = apps.filter((app) => {
		if (tab === "active") return ["pending", "accepted"].includes(app.status);
		return ["completed", "no_show"].includes(app.status);
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-24 lg:pb-12 bg-[#111111] min-h-screen pt-4",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "relative w-full pt-12 pb-24 hero-gradient-overlay flex flex-col items-center justify-center text-center px-4 overflow-hidden mb-6",
			children: [
				/* @__PURE__ */ jsx("div", { className: "absolute top-0 right-[20%] w-[250px] h-[250px] floating-glass-rect rotate-12 z-0 hidden lg:block opacity-40" }),
				/* @__PURE__ */ jsx("h1", {
					className: "text-4xl lg:text-5xl font-black text-white mb-3 tracking-tight relative z-10 drop-shadow-md",
					children: "My Gigs"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "text-white/60 font-medium text-base lg:text-lg mb-8 max-w-md relative z-10 leading-relaxed",
					children: "Track your ongoing applications and review past events."
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "flex bg-[#1C1C1C] border border-white/10 p-1.5 rounded-full w-full lg:w-[400px] shadow-lg relative z-10 overflow-x-auto hide-scrollbar",
					children: [/* @__PURE__ */ jsx("button", {
						onClick: () => setTab("active"),
						className: `flex-1 min-w-[120px] min-h-[44px] py-1.5 text-sm font-bold rounded-full transition-all btn-tap ${tab === "active" ? "bg-[#F4511E] text-white shadow-md" : "text-white/60 hover:text-white flex items-center justify-center"}`,
						children: "Active Gigs"
					}), /* @__PURE__ */ jsx("button", {
						onClick: () => setTab("past"),
						className: `flex-1 min-w-[120px] min-h-[44px] py-1.5 text-sm font-bold rounded-full transition-all btn-tap ${tab === "past" ? "bg-[#F4511E] text-white shadow-md" : "text-white/60 hover:text-white flex items-center justify-center"}`,
						children: "Past Events"
					})]
				})
			]
		}), /* @__PURE__ */ jsx("div", {
			className: "px-4 xl:px-12 w-full mx-auto",
			children: /* @__PURE__ */ jsx("div", {
				className: "w-full lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-6",
				children: loading ? /* @__PURE__ */ jsx("div", {
					className: "flex justify-center p-10 col-span-full",
					children: /* @__PURE__ */ jsx("div", { className: "w-8 h-8 border-4 border-white/10 border-t-[#F4511E] rounded-full animate-spin" })
				}) : filteredApps.length === 0 ? /* @__PURE__ */ jsxs("div", {
					className: "bg-[#1C1C1C] rounded-2xl p-8 lg:p-12 text-center shadow-sm border border-white/5 flex flex-col items-center mt-2 col-span-full",
					children: [
						/* @__PURE__ */ jsx("div", {
							className: "w-20 h-20 bg-white/5 rounded-full flex justify-center items-center text-[#F4511E] mb-5",
							children: /* @__PURE__ */ jsx(Briefcase, { size: 32 })
						}),
						/* @__PURE__ */ jsxs("p", {
							className: "text-white font-black mb-2 text-xl tracking-tight",
							children: [
								"No ",
								tab,
								" gigs found"
							]
						}),
						/* @__PURE__ */ jsx("p", {
							className: "text-base font-medium text-white/50 max-w-sm",
							children: tab === "active" ? "No active gigs — browse available jobs" : "You haven't completed any gigs yet."
						}),
						tab === "active" && /* @__PURE__ */ jsx("button", {
							onClick: () => navigate("/worker/home"),
							className: "mt-8 px-8 py-3.5 min-h-[44px] bg-[#F4511E] text-white text-sm font-black tracking-wide rounded-xl shadow-lg hover:bg-[#D84315] transition-colors btn-tap",
							children: "Browse Live Gigs"
						})
					]
				}) : /* @__PURE__ */ jsx(Fragment, { children: filteredApps.map((app) => {
					if (!app.gig) return null;
					const sParams = getStatusParams(app.status);
					const totalPay = app.gig.pay_rate * app.gig.duration_hrs;
					return /* @__PURE__ */ jsxs("div", {
						onClick: () => navigate(`/gigs/${app.gig.id}`),
						className: "bg-[#1C1C1C] rounded-2xl p-5 lg:p-6 shadow-sm border border-white/5 flex flex-col btn-tap cursor-pointer group hover:border-[#F4511E]/30 transition-all hover:shadow-md mt-4 lg:mt-0",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex justify-between items-start mb-5",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "flex pr-4",
								children: [/* @__PURE__ */ jsx("img", {
									src: getImageUrl(app.gig.role_type),
									alt: app.gig.role_type,
									loading: "lazy",
									decoding: "async",
									className: "w-12 h-12 rounded-xl object-cover mr-4"
								}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
									className: "font-black text-white text-lg lg:text-xl leading-tight mb-1",
									children: app.gig.title
								}), /* @__PURE__ */ jsx("p", {
									className: "text-white/50 font-medium text-sm",
									children: app.gig.location_text
								})] })]
							}), /* @__PURE__ */ jsx("div", {
								className: `px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border whitespace-nowrap shadow-sm ${tab === "active" && app.status === "accepted" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-white/10 text-white/70 border-white/20"}`,
								children: sParams.label
							})]
						}), /* @__PURE__ */ jsxs("div", {
							className: "flex justify-between items-end mt-auto pt-5 border-t border-white/5",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "flex items-center text-white/60 text-sm font-bold bg-[#111111] px-3 py-1.5 rounded-lg border border-white/5",
								children: [/* @__PURE__ */ jsx(Calendar, {
									size: 14,
									className: "mr-2 text-[#F4511E]"
								}), formatRelativeDate(app.gig.event_date)]
							}), /* @__PURE__ */ jsxs("div", {
								className: "flex items-center",
								children: [/* @__PURE__ */ jsxs("span", {
									className: "font-black text-[#F4511E] text-2xl mr-2 tracking-tight",
									children: ["₹", totalPay]
								}), /* @__PURE__ */ jsx("div", {
									className: "w-8 h-8 rounded-full bg-[#111111] flex items-center justify-center group-hover:bg-[#F4511E]/10 transition-colors border border-white/5 group-hover:border-[#F4511E]/20",
									children: /* @__PURE__ */ jsx(ChevronRight, {
										size: 16,
										className: "text-white/40 group-hover:text-[#F4511E] transition-colors"
									})
								})]
							})]
						})]
					}, app.id);
				}) })
			})
		})]
	});
});
//#endregion
//#region app/routes/worker.earnings.tsx
var worker_earnings_exports = /* @__PURE__ */ __exportAll({ default: () => worker_earnings_default });
var worker_earnings_default = UNSAFE_withComponentProps(function EarningsScreen() {
	const { user } = useAuth();
	const [apps, setApps] = useState([]);
	const [totalEarned, setTotalEarned] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	useEffect(() => {
		if (user) fetchCompletedGigs();
	}, [user]);
	const fetchCompletedGigs = async () => {
		setLoading(true);
		setError("");
		try {
			const { data, error: fetchError } = await (void 0).from("applications").select(`*, gig:gigs(*)`).eq("worker_id", user.id).eq("status", "completed").order("applied_at", { ascending: false });
			if (fetchError) throw fetchError;
			const fetchedApps = data || [];
			setApps(fetchedApps);
			setTotalEarned(fetchedApps.reduce((acc, app) => {
				if (!app.gig) return acc;
				return acc + app.gig.pay_rate * app.gig.duration_hrs;
			}, 0));
		} catch (err) {
			console.error(err);
			setError("Something went wrong. Try again.");
		} finally {
			setLoading(false);
		}
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-24 lg:pb-12 bg-background min-h-screen",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "relative w-full pt-12 pb-24 hero-gradient-overlay flex flex-col items-center justify-center text-center px-4 overflow-hidden mb-6",
			children: [
				/* @__PURE__ */ jsx("div", { className: "absolute top-10 right-[30%] w-[300px] h-[300px] floating-glass-rect -rotate-12 z-0 hidden lg:block opacity-40" }),
				/* @__PURE__ */ jsx("div", { className: "absolute bottom-0 left-[10%] w-[400px] h-[200px] floating-glass-rect rotate-6 z-0 hidden lg:block opacity-30" }),
				/* @__PURE__ */ jsx("h1", {
					className: "text-3xl lg:text-5xl font-black text-white mb-8 tracking-tight relative z-10 drop-shadow-md",
					children: "Earnings Dashboard"
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "flex flex-col items-center justify-center text-center relative z-10 w-full",
					children: [
						/* @__PURE__ */ jsx("div", {
							className: "w-16 h-16 lg:w-20 lg:h-20 bg-white/20 rounded-full flex items-center justify-center text-white mb-4 shadow-xl backdrop-blur-md border border-white/40 group-hover:scale-110 transition-transform",
							children: /* @__PURE__ */ jsx(Wallet, {
								size: 28,
								className: "lg:w-8 lg:h-8"
							})
						}),
						/* @__PURE__ */ jsx("h2", {
							className: "text-cyan-100 font-extrabold uppercase tracking-widest text-[11px] lg:text-xs mb-2",
							children: "Lifetime Earned"
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "text-6xl lg:text-[100px] font-black text-white tracking-tighter leading-none drop-shadow-xl",
							children: ["₹", totalEarned.toLocaleString("en-IN")]
						})
					]
				})
			]
		}), /* @__PURE__ */ jsxs("div", {
			className: "px-4 xl:px-12 w-full mx-auto relative z-10 lg:grid lg:grid-cols-3 lg:gap-8 items-start",
			children: [/* @__PURE__ */ jsx("div", {
				className: "lg:col-span-1",
				children: /* @__PURE__ */ jsxs("div", {
					className: "bg-white rounded-3xl shadow-sm border border-slate-100 p-6 lg:p-8 flex justify-between items-center mb-6 lg:mb-0",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
						className: "text-xs lg:text-sm font-black uppercase tracking-widest text-slate-400 mb-1",
						children: "Missions Completed"
					}), /* @__PURE__ */ jsx("p", {
						className: "text-4xl lg:text-5xl font-black text-slate-900 tracking-tight",
						children: apps.length
					})] }), /* @__PURE__ */ jsx("div", {
						className: "w-14 h-14 lg:w-16 lg:h-16 bg-green-50 text-accent rounded-full flex justify-center items-center shadow-inner border border-green-100",
						children: /* @__PURE__ */ jsx(Banknote, {
							size: 24,
							className: "lg:w-8 lg:h-8"
						})
					})]
				})
			}), /* @__PURE__ */ jsxs("div", {
				className: "lg:col-span-2",
				children: [
					/* @__PURE__ */ jsx("h2", {
						className: "text-xl lg:text-2xl font-black text-slate-800 mb-5 tracking-tight px-2",
						children: "Payout History"
					}),
					error && /* @__PURE__ */ jsxs("div", {
						className: "bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border border-red-100 mb-5 flex items-center",
						children: [/* @__PURE__ */ jsx(AlertCircle, {
							size: 18,
							className: "mr-2"
						}), /* @__PURE__ */ jsx("span", { children: error })]
					}),
					loading ? /* @__PURE__ */ jsx("div", {
						className: "flex justify-center p-10",
						children: /* @__PURE__ */ jsx("div", { className: "w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" })
					}) : apps.length === 0 && !error ? /* @__PURE__ */ jsxs("div", {
						className: "bg-white border border-slate-100 rounded-3xl p-8 lg:p-12 flex flex-col items-center justify-center text-center shadow-sm",
						children: [
							/* @__PURE__ */ jsx("div", {
								className: "w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 text-slate-300 shadow-inner border border-slate-100",
								children: /* @__PURE__ */ jsx(Banknote, { size: 32 })
							}),
							/* @__PURE__ */ jsx("p", {
								className: "text-slate-900 font-black mb-2 text-xl tracking-tight",
								children: "No earnings yet"
							}),
							/* @__PURE__ */ jsx("p", {
								className: "text-base font-medium text-slate-500 max-w-xs",
								children: "Complete your first gig to watch your earnings grow here."
							})
						]
					}) : /* @__PURE__ */ jsx("div", {
						className: "space-y-3 lg:space-y-4",
						children: apps.map((app) => {
							if (!app.gig) return null;
							return /* @__PURE__ */ jsxs("div", {
								className: "bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md hover:border-blue-100 transition-all cursor-default animate-in fade-in duration-300",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "flex items-center",
									children: [/* @__PURE__ */ jsx("div", {
										className: "w-12 h-12 bg-orange-50 text-primary rounded-full flex items-center justify-center mr-4 lg:mr-5 border border-orange-100",
										children: /* @__PURE__ */ jsx(Banknote, { size: 20 })
									}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
										className: "font-black text-slate-900 leading-tight lg:text-lg mb-1 tracking-tight",
										children: app.gig.title
									}), /* @__PURE__ */ jsxs("div", {
										className: "flex items-center text-xs lg:text-sm font-bold text-slate-500",
										children: [/* @__PURE__ */ jsx(Calendar, {
											size: 12,
											className: "mr-1.5 text-slate-400"
										}), formatRelativeDate(app.gig.event_date)]
									})] })]
								}), /* @__PURE__ */ jsx("div", {
									className: "text-right",
									children: /* @__PURE__ */ jsxs("div", {
										className: "font-black text-accent text-xl lg:text-2xl tracking-tighter",
										children: ["+₹", app.gig.pay_rate * app.gig.duration_hrs]
									})
								})]
							}, app.id);
						})
					})
				]
			})]
		})]
	});
});
//#endregion
//#region app/routes/worker.profile.tsx
var worker_profile_exports = /* @__PURE__ */ __exportAll({ default: () => worker_profile_default });
var ALL_SKILLS = [
	"Waiter",
	"Bartender",
	"Event Helper",
	"Singer",
	"Dancer",
	"Sketch Artist",
	"Photographer",
	"DJ",
	"Emcee",
	"Security"
];
var MOCK_TROPHIES = [
	{
		id: 1,
		title: "First Gig",
		icon: "🌟",
		date: "Earned Mar 12"
	},
	{
		id: 2,
		title: "5-Star Streak",
		icon: "🔥",
		date: "Earned Mar 18"
	},
	{
		id: 3,
		title: "Weekend Hustler",
		icon: "⚡",
		date: "Earned Mar 25"
	}
];
var worker_profile_default = UNSAFE_withComponentProps(function ProfileScreen() {
	const { user, profile, setProfile, signOut } = useAuth();
	const [loading, setLoading] = useState(true);
	const [stats, setStats] = useState({
		completedGigs: 0,
		avgRating: 0,
		totalEarned: 0
	});
	const [skills, setSkills] = useState([]);
	const [ratings, setRatings] = useState([]);
	const [isEditingProfile, setIsEditingProfile] = useState(false);
	const [editName, setEditName] = useState("");
	const [editCity, setEditCity] = useState("");
	const [savingProfile, setSavingProfile] = useState(false);
	const [showSkillsModal, setShowSkillsModal] = useState(false);
	const [tempSkills, setTempSkills] = useState([]);
	const [savingSkills, setSavingSkills] = useState(false);
	useEffect(() => {
		if (user) {
			setEditName(profile?.full_name || "");
			setEditCity(profile?.city || "Indore");
			fetchWorkerData();
		}
	}, [user, profile]);
	const fetchWorkerData = async () => {
		setLoading(true);
		try {
			const { data: appsData, count } = await (void 0).from("applications").select("*, gig:gigs(*)", { count: "exact" }).eq("worker_id", user.id).eq("status", "completed");
			const completedGigs = count || 0;
			const totalEarned = (appsData || []).reduce((acc, app) => {
				if (!app.gig) return acc;
				return acc + app.gig.pay_rate * app.gig.duration_hrs;
			}, 0);
			const { data: ratingData, error: ratingError } = await (void 0).from("ratings").select(`
          score,
          comment,
          rater:profiles!ratings_rater_id_fkey(full_name)
        `).eq("ratee_id", user.id).order("created_at", { ascending: false }).limit(3);
			let fetchedRatings = [];
			let avgRating = 0;
			if (!ratingError && ratingData) {
				fetchedRatings = ratingData.map((r) => ({
					score: r.score,
					comment: r.comment,
					reviewer_name: r.rater?.full_name || "Verified Organizer"
				}));
				if (fetchedRatings.length > 0) avgRating = (fetchedRatings.reduce((acc, r) => acc + r.score, 0) / fetchedRatings.length).toFixed(1);
			}
			const { data: skillsData } = await (void 0).from("worker_skills").select("skill").eq("worker_id", user.id);
			const fetchedSkills = (skillsData || []).map((s) => s.skill);
			setStats({
				completedGigs,
				avgRating,
				totalEarned
			});
			setRatings(fetchedRatings);
			setSkills(fetchedSkills);
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	};
	const handleSaveSkills = async () => {
		setSavingSkills(true);
		try {
			if (tempSkills.length > 0) {
				await (void 0).from("worker_skills").delete().eq("worker_id", user.id).not("skill", "in", `(${tempSkills.join(",")})`);
				const inserts = tempSkills.map((s) => ({
					worker_id: user.id,
					skill: s
				}));
				await (void 0).from("worker_skills").upsert(inserts, { onConflict: "worker_id,skill" });
			} else await (void 0).from("worker_skills").delete().eq("worker_id", user.id);
			setSkills(tempSkills);
			setShowSkillsModal(false);
		} catch (err) {
			console.error(err);
		} finally {
			setSavingSkills(false);
		}
	};
	const handleSaveProfile = async () => {
		if (!editName) return;
		setSavingProfile(true);
		try {
			const { error } = await (void 0).from("profiles").update({
				full_name: editName,
				city: editCity
			}).eq("id", user.id);
			if (error) throw error;
			setProfile({
				...profile,
				full_name: editName,
				city: editCity
			});
			setIsEditingProfile(false);
		} catch (err) {
			console.error(err);
		} finally {
			setSavingProfile(false);
		}
	};
	const gigs = stats.completedGigs;
	let level = "Beginner";
	let nextLevelGigs = 5;
	let progress = gigs / 5 * 100;
	let levelColor = "text-slate-500";
	if (gigs > 30) {
		level = "Elite";
		nextLevelGigs = gigs;
		progress = 100;
		levelColor = "text-amber-500";
	} else if (gigs > 15) {
		level = "Pro";
		nextLevelGigs = 30;
		progress = (gigs - 15) / 15 * 100;
		levelColor = "text-accent";
	} else if (gigs > 5) {
		level = "Intermediate";
		nextLevelGigs = 15;
		progress = (gigs - 5) / 10 * 100;
		levelColor = "text-primary";
	}
	const reliability = 97;
	const relColorClass = reliability > 80 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700";
	if (loading) return /* @__PURE__ */ jsx("div", {
		className: "min-h-screen flex justify-center pt-20 bg-[#111111]",
		children: /* @__PURE__ */ jsx("div", { className: "w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" })
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-24 lg:pb-12 bg-[#111111] min-h-screen relative lg:px-12 lg:pt-10 lg:max-w-7xl lg:mx-auto pt-16",
		children: [showSkillsModal && /* @__PURE__ */ jsx("div", {
			className: "fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center sm:justify-center animate-in fade-in",
			children: /* @__PURE__ */ jsxs("div", {
				className: "bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 pb-12 animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-4 shadow-2xl",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex justify-between items-center mb-6",
						children: [/* @__PURE__ */ jsx("h2", {
							className: "text-xl font-black text-slate-800",
							children: "Edit Skills"
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => setShowSkillsModal(false),
							className: "p-2 bg-slate-100 text-slate-500 rounded-full btn-tap",
							children: /* @__PURE__ */ jsx(X, { size: 18 })
						})]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "flex flex-wrap gap-2 mb-8",
						children: ALL_SKILLS.map((skill) => /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => {
								if (tempSkills.includes(skill)) setTempSkills(tempSkills.filter((s) => s !== skill));
								else setTempSkills([...tempSkills, skill]);
							},
							className: `px-4 py-2 min-h-[44px] rounded-full text-sm font-bold border btn-tap transition-colors ${tempSkills.includes(skill) ? "bg-primary border-primary text-white" : "bg-white border-slate-200 text-slate-600 hover:border-primary hover:text-primary"}`,
							children: skill
						}, skill))
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: handleSaveSkills,
						disabled: savingSkills,
						className: "w-full min-h-[44px] py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 btn-tap disabled:opacity-50",
						children: savingSkills ? "Saving..." : "Confirm Edits"
					})
				]
			})
		}), /* @__PURE__ */ jsxs("div", {
			className: "lg:grid lg:grid-cols-[30%_70%] lg:gap-10 items-start",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "w-full lg:sticky lg:top-24 space-y-4 lg:space-y-6 font-sans",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "bg-[#1C1C1C] lg:rounded-3xl pt-10 pb-6 px-5 border-b lg:border border-white/5 flex flex-col items-center relative lg:shadow-sm",
						children: [
							/* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: signOut,
								className: "absolute top-6 right-5 p-2 text-white/40 lg:hidden hover:text-[#F4511E] hover:bg-[#F4511E]/10 rounded-full transition-colors btn-tap",
								children: /* @__PURE__ */ jsx(LogOut, { size: 20 })
							}),
							/* @__PURE__ */ jsx("div", {
								className: "w-20 h-20 bg-primary rounded-full flex items-center justify-center text-white text-3xl font-black mb-3 shadow-md lg:w-32 lg:h-32 lg:text-5xl lg:mb-5",
								children: profile?.full_name?.charAt(0) || "W"
							}),
							isEditingProfile ? /* @__PURE__ */ jsxs("div", {
								className: "flex flex-col items-center w-full max-w-[250px] mb-3",
								children: [
									/* @__PURE__ */ jsx("input", {
										type: "text",
										value: editName,
										onChange: (e) => setEditName(e.target.value),
										className: "w-full text-center text-lg lg:text-xl font-black text-white border-b-2 border-[#F4511E] focus:outline-none mb-2 pb-1 bg-transparent placeholder-white/20",
										placeholder: "Your Name"
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "flex items-center w-full border-b-2 border-[#F4511E] pb-1 mb-3",
										children: [/* @__PURE__ */ jsx(MapPin, {
											size: 14,
											className: "text-white/40 mr-2"
										}), /* @__PURE__ */ jsx("input", {
											type: "text",
											value: editCity,
											onChange: (e) => setEditCity(e.target.value),
											className: "w-full text-sm font-medium text-white/70 focus:outline-none bg-transparent placeholder-white/20",
											placeholder: "Your City"
										})]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "flex space-x-2",
										children: [/* @__PURE__ */ jsx("button", {
											type: "button",
											onClick: () => setIsEditingProfile(false),
											className: "px-4 min-h-[44px] rounded-full text-xs font-bold bg-white/10 text-white/70 hover:bg-white/20 btn-tap",
											children: "Cancel"
										}), /* @__PURE__ */ jsx("button", {
											type: "button",
											onClick: handleSaveProfile,
											disabled: savingProfile,
											className: "px-4 min-h-[44px] rounded-full text-xs font-bold bg-[#F4511E] text-white shadow-sm flex items-center btn-tap",
											children: savingProfile ? "Saving..." : /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Check, {
												size: 16,
												className: "mr-1"
											}), " Save"] })
										})]
									})
								]
							}) : /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("h1", {
								className: "text-xl lg:text-3xl font-black text-white mb-1 lg:mb-2 flex items-center tracking-tight",
								children: [profile?.full_name || "Worker", /* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: () => setIsEditingProfile(true),
									className: "ml-2 text-white/40 hover:text-[#F4511E] btn-tap",
									children: /* @__PURE__ */ jsx(Edit2, { size: 16 })
								})]
							}), /* @__PURE__ */ jsxs("div", {
								className: "flex items-center text-white/50 text-sm lg:text-base font-medium mb-3 lg:mb-5",
								children: [
									/* @__PURE__ */ jsx(MapPin, {
										size: 16,
										className: "mr-1"
									}),
									" ",
									profile?.city || "Indore"
								]
							})] }),
							/* @__PURE__ */ jsxs("div", {
								className: `px-4 py-1.5 rounded-full text-xs lg:text-sm font-bold ${relColorClass === "bg-green-100 text-green-700" ? "bg-green-500/10 text-green-400" : "bg-orange-500/10 text-orange-400"}`,
								children: [reliability, "% Reliable"]
							})
						]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mx-5 lg:mx-0 bg-[#1C1C1C] rounded-2xl p-5 lg:p-8 shadow-sm border border-white/5",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex justify-between items-center mb-3 lg:mb-4",
								children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
									className: "text-sm font-bold text-white/40 uppercase tracking-widest mb-0.5",
									children: "Current Status"
								}), /* @__PURE__ */ jsx("div", {
									className: `text-xl lg:text-2xl font-black ${levelColor === "text-primary" ? "text-[#00BCD4]" : levelColor === "text-accent" ? "text-[#F4511E]" : levelColor === "text-amber-500" ? "text-amber-400" : "text-white/60"}`,
									children: level
								})] }), /* @__PURE__ */ jsx("div", {
									className: "w-12 h-12 lg:w-16 lg:h-16 bg-white/5 rounded-full flex items-center justify-center text-white/30 border border-white/10 shadow-inner",
									children: /* @__PURE__ */ jsx(Award, {
										size: 24,
										className: "lg:w-8 lg:h-8"
									})
								})]
							}),
							/* @__PURE__ */ jsx("div", {
								className: "w-full bg-[#111111] rounded-full h-3 lg:h-4 overflow-hidden mb-2",
								children: /* @__PURE__ */ jsx("div", {
									className: "bg-[#F4511E] h-full rounded-full transition-all duration-1000",
									style: { width: `${progress}%` }
								})
							}),
							/* @__PURE__ */ jsxs("p", {
								className: "text-xs lg:text-sm font-bold text-white/40 text-right",
								children: [nextLevelGigs - gigs, " gigs to next level"]
							})
						]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "mx-5 lg:mx-0 bg-[#1C1C1C] rounded-2xl shadow-sm border border-white/5 overflow-hidden",
						children: /* @__PURE__ */ jsxs("details", {
							className: "group",
							children: [/* @__PURE__ */ jsxs("summary", {
								className: "font-bold text-white p-5 cursor-pointer flex justify-between items-center list-none outline-none",
								children: ["Benefits you can unlock", /* @__PURE__ */ jsx("span", {
									className: "transition group-open:rotate-180",
									children: /* @__PURE__ */ jsx("svg", {
										fill: "none",
										height: "24",
										stroke: "currentColor",
										strokeLinecap: "round",
										strokeLinejoin: "round",
										strokeWidth: "2",
										viewBox: "0 0 24 24",
										w: "24",
										className: "text-white/50",
										children: /* @__PURE__ */ jsx("polyline", { points: "6 9 12 15 18 9" })
									})
								})]
							}), /* @__PURE__ */ jsxs("div", {
								className: "p-5 border-t border-white/5 space-y-4",
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: "flex items-start",
										children: [/* @__PURE__ */ jsx("div", {
											className: "w-6 h-6 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center mr-3 shrink-0",
											children: /* @__PURE__ */ jsx(Check, { size: 14 })
										}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
											className: "text-sm font-bold text-white",
											children: "Basic Access"
										}), /* @__PURE__ */ jsx("p", {
											className: "text-xs text-white/50",
											children: "Unlocked at 0 gigs."
										})] })]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "flex items-start",
										children: [/* @__PURE__ */ jsx("div", {
											className: `w-6 h-6 rounded-full flex items-center justify-center mr-3 shrink-0 ${gigs >= 5 ? "bg-green-500/10 text-green-400" : "bg-white/5 text-white/30"}`,
											children: gigs >= 5 ? /* @__PURE__ */ jsx(Check, { size: 14 }) : /* @__PURE__ */ jsx(Lock, { size: 14 })
										}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
											className: `text-sm font-bold ${gigs >= 5 ? "text-white" : "text-white/60"}`,
											children: "Premium Gigs"
										}), /* @__PURE__ */ jsx("p", {
											className: "text-xs text-white/50",
											children: "Unlock exclusive high-paying gigs at 5 gigs."
										})] })]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "flex items-start",
										children: [/* @__PURE__ */ jsx("div", {
											className: `w-6 h-6 rounded-full flex items-center justify-center mr-3 shrink-0 ${gigs >= 15 ? "bg-green-500/10 text-green-400" : "bg-white/5 text-white/30"}`,
											children: gigs >= 15 ? /* @__PURE__ */ jsx(Check, { size: 14 }) : /* @__PURE__ */ jsx(Lock, { size: 14 })
										}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
											className: `text-sm font-bold ${gigs >= 15 ? "text-white" : "text-white/60"}`,
											children: "Cash Bonus"
										}), /* @__PURE__ */ jsx("p", {
											className: "text-xs text-white/50",
											children: "Earn a ₹500 bonus upon completing 15 gigs."
										})] })]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "flex items-start",
										children: [/* @__PURE__ */ jsx("div", {
											className: `w-6 h-6 rounded-full flex items-center justify-center mr-3 shrink-0 ${gigs >= 30 ? "bg-green-500/10 text-green-400" : "bg-white/5 text-white/30"}`,
											children: gigs >= 30 ? /* @__PURE__ */ jsx(Check, { size: 14 }) : /* @__PURE__ */ jsx(Lock, { size: 14 })
										}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
											className: `text-sm font-bold ${gigs >= 30 ? "text-white" : "text-white/60"}`,
											children: "Top Tier Pro"
										}), /* @__PURE__ */ jsx("p", {
											className: "text-xs text-white/50",
											children: "Priority selection & voucher rewards at 30 gigs."
										})] })]
									})
								]
							})]
						})
					})
				]
			}), /* @__PURE__ */ jsxs("div", {
				className: "px-5 lg:px-0 mt-6 lg:mt-0 space-y-6 lg:space-y-8",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "hero-gradient-overlay rounded-2xl p-6 lg:p-8 text-white shadow-lg space-y-4 border border-white/10",
						children: [
							/* @__PURE__ */ jsx("div", {
								className: "text-white/60 text-xs lg:text-sm font-bold uppercase tracking-wider mb-2",
								children: "Total Earned"
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "text-4xl lg:text-6xl font-black mb-5 lg:mb-8 flex items-baseline",
								children: [/* @__PURE__ */ jsxs("span", { children: ["₹", stats.totalEarned.toLocaleString("en-IN")] }), /* @__PURE__ */ jsx("span", {
									className: "text-sm lg:text-base font-medium text-[#F4511E] ml-2 lg:ml-4",
									children: "lifetime"
								})]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "flex justify-between border-t border-white/20 pt-5 lg:pt-6",
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: "text-center",
										children: [/* @__PURE__ */ jsx("p", {
											className: "text-xl lg:text-2xl font-black mb-1",
											children: stats.completedGigs
										}), /* @__PURE__ */ jsx("p", {
											className: "text-[10px] lg:text-xs text-white/50 font-bold uppercase tracking-widest",
											children: "Gigs Done"
										})]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "text-center",
										children: [/* @__PURE__ */ jsxs("p", {
											className: "text-xl lg:text-2xl font-black mb-1 flex items-center justify-center",
											children: [
												stats.avgRating > 0 ? stats.avgRating : "-",
												" ",
												/* @__PURE__ */ jsx(Star, {
													size: 14,
													className: "ml-1 text-amber-400 fill-current"
												})
											]
										}), /* @__PURE__ */ jsx("p", {
											className: "text-[10px] lg:text-xs text-white/50 font-bold uppercase tracking-widest",
											children: "Avg Rating"
										})]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "text-center",
										children: [/* @__PURE__ */ jsx("p", {
											className: "text-xl lg:text-2xl font-black mb-1 text-white/80",
											children: "2024"
										}), /* @__PURE__ */ jsx("p", {
											className: "text-[10px] lg:text-xs text-white/50 font-bold uppercase tracking-widest",
											children: "Member"
										})]
									})
								]
							})
						]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "bg-[#1C1C1C] rounded-2xl shadow-sm border border-white/5 p-5 lg:p-8",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex justify-between items-center mb-4 lg:mb-6",
							children: [/* @__PURE__ */ jsx("h3", {
								className: "font-bold text-white lg:text-xl",
								children: "My Skills"
							}), /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => {
									setTempSkills([...skills]);
									setShowSkillsModal(true);
								},
								className: "text-[#F4511E] text-sm font-bold hover:underline btn-tap min-h-[44px] flex items-center",
								children: "Edit"
							})]
						}), skills.length > 0 ? /* @__PURE__ */ jsx("div", {
							className: "flex flex-wrap gap-2 lg:gap-3",
							children: skills.map((skill) => /* @__PURE__ */ jsx("div", {
								className: "px-3 py-1.5 lg:px-4 lg:py-2 bg-[#111111] text-white/80 border border-white/10 rounded-lg text-sm lg:text-base font-bold shadow-sm",
								children: skill
							}, skill))
						}) : /* @__PURE__ */ jsx("div", {
							className: "text-sm font-medium text-white/40 bg-[#111111] p-4 rounded-xl border border-white/5 border-dashed",
							children: "No skills added yet. Tap edit to select some."
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "bg-[#1C1C1C] rounded-2xl p-5 lg:p-8 shadow-sm border border-white/5 overflow-hidden",
						children: [/* @__PURE__ */ jsxs("h3", {
							className: "font-bold text-white mb-4 lg:mb-6 lg:text-xl",
							children: ["Trophies ", /* @__PURE__ */ jsxs("span", {
								className: "text-white/40 font-medium text-xs ml-2",
								children: [
									"(",
									MOCK_TROPHIES.length,
									")"
								]
							})]
						}), /* @__PURE__ */ jsxs("div", {
							className: "flex space-x-3 overflow-x-auto pb-2 hide-scrollbar",
							children: [MOCK_TROPHIES.map((trophy) => /* @__PURE__ */ jsxs("div", {
								className: "min-w-[120px] lg:min-w-[150px] bg-[#111111] rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center text-center",
								children: [
									/* @__PURE__ */ jsx("div", {
										className: "text-3xl lg:text-4xl mb-3 mt-1 bg-[#1C1C1C] w-14 h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center shadow-sm border border-white/5",
										children: trophy.icon
									}),
									/* @__PURE__ */ jsx("p", {
										className: "font-bold text-white text-sm leading-tight mb-1",
										children: trophy.title
									}),
									/* @__PURE__ */ jsx("p", {
										className: "text-[10px] text-white/40 font-bold uppercase tracking-wider",
										children: trophy.date
									})
								]
							}, trophy.id)), /* @__PURE__ */ jsxs("div", {
								className: "min-w-[120px] lg:min-w-[150px] bg-[#1C1C1C] rounded-2xl p-4 border border-white/10 border-dashed flex flex-col items-center justify-center text-center opacity-70",
								children: [
									/* @__PURE__ */ jsx("div", {
										className: "text-3xl mb-3 mt-1 text-white/30 bg-[#111111] w-14 h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center shadow-inner",
										children: /* @__PURE__ */ jsx(Lock, { size: 20 })
									}),
									/* @__PURE__ */ jsx("p", {
										className: "font-bold text-white/40 text-sm leading-tight mb-1",
										children: "Locked"
									}),
									/* @__PURE__ */ jsx("p", {
										className: "text-[10px] text-white/30 font-bold uppercase tracking-wider",
										children: "Do 50 gigs"
									})
								]
							})]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "bg-[#1C1C1C] rounded-2xl shadow-sm border border-white/5 p-5 lg:p-8 mb-8",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex justify-between items-center mb-4 lg:mb-6",
							children: [/* @__PURE__ */ jsx("h3", {
								className: "font-bold text-white lg:text-xl",
								children: "Reviews"
							}), /* @__PURE__ */ jsxs("div", {
								className: "flex items-center",
								children: [/* @__PURE__ */ jsx(Star, {
									size: 16,
									className: "text-amber-400 fill-current mr-1"
								}), /* @__PURE__ */ jsx("span", {
									className: "font-black text-white",
									children: stats.avgRating > 0 ? stats.avgRating : "New"
								})]
							})]
						}), ratings.length > 0 ? /* @__PURE__ */ jsx("div", {
							className: "space-y-4 lg:space-y-6",
							children: ratings.map((r, i) => /* @__PURE__ */ jsxs("div", {
								className: "border-b border-white/5 pb-4 lg:pb-6 last:border-0 last:pb-0",
								children: [
									/* @__PURE__ */ jsx("div", {
										className: "flex mb-2 text-amber-400",
										children: Array.from({ length: r.score }).map((_, idx) => /* @__PURE__ */ jsx(Star, {
											size: 14,
											className: "fill-current"
										}, idx))
									}),
									/* @__PURE__ */ jsxs("p", {
										className: "text-white/80 font-medium text-sm lg:text-base leading-relaxed mb-3",
										children: [
											"\"",
											r.comment,
											"\""
										]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "flex items-center text-xs font-bold text-white/50",
										children: [/* @__PURE__ */ jsx("div", {
											className: "w-5 h-5 bg-white/10 text-white/60 rounded-full flex items-center justify-center mr-2",
											children: r.reviewer_name?.charAt(0)
										}), r.reviewer_name]
									})
								]
							}, i))
						}) : /* @__PURE__ */ jsxs("div", {
							className: "bg-[#111111] border border-white/5 rounded-2xl p-6 lg:p-10 flex flex-col items-center justify-center text-center",
							children: [/* @__PURE__ */ jsx("div", {
								className: "w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-amber-400 shadow-sm mb-3",
								children: /* @__PURE__ */ jsx(Star, { size: 20 })
							}), /* @__PURE__ */ jsx("p", {
								className: "text-white/50 font-medium text-sm lg:text-base",
								children: "No reviews yet. Complete your first gig to get rated."
							})]
						})]
					})
				]
			})]
		})]
	});
});
//#endregion
//#region app/routes/organizer.home.tsx
var organizer_home_exports = /* @__PURE__ */ __exportAll({ default: () => organizer_home_default });
var organizer_home_default = UNSAFE_withComponentProps(function OrganizerHomeScreen() {
	const navigate = useNavigate();
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-screen bg-background font-sans flex flex-col items-center justify-center p-6 relative text-center",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "absolute top-6 left-6 lg:top-10 lg:left-12 flex items-center",
				children: [/* @__PURE__ */ jsxs("span", {
					className: "text-xl lg:text-2xl font-bold tracking-tight text-slate-900 drop-shadow-sm",
					children: ["Gig", /* @__PURE__ */ jsx("span", {
						className: "text-[#F4511E] italic font-black",
						children: "Dekho"
					})]
				}), /* @__PURE__ */ jsx("span", {
					className: "ml-3 bg-slate-900 text-white text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full",
					children: "Organizer"
				})]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "w-24 h-24 lg:w-32 lg:h-32 bg-slate-800 rounded-full shadow-lg flex items-center justify-center text-5xl lg:text-6xl mb-8 border border-slate-700 mx-auto",
				children: "🎪"
			}),
			/* @__PURE__ */ jsx("h1", {
				className: "text-3xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4 max-w-lg",
				children: "Organizer Dashboard"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "text-slate-600 font-medium text-lg lg:text-xl max-w-md mx-auto mb-10 leading-relaxed",
				children: "We're building something great for you. Manage your events, track applications, and hire instantly. Check back soon."
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => navigate("/worker/home"),
				className: "text-[#F4511E] font-bold text-sm lg:text-base border-b-2 border-transparent hover:border-[#F4511E] pb-0.5 transition-all min-h-[44px]",
				children: "Browse as Worker instead"
			})
		]
	});
});
//#endregion
//#region app/routes/sitemap[.]xml.tsx
var sitemap___xml_exports = /* @__PURE__ */ __exportAll({ loader: () => loader$1 });
async function loader$1({ request }) {
	const { data: gigs } = await createSupabaseServerClient(request).from("gigs").select("id, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(1e3);
	const base = "https://gigdekho.com";
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const staticUrls = [`<url><loc>${base}/</loc><lastmod>${now}</lastmod><priority>1.0</priority></url>`];
	const gigUrls = (gigs ?? []).map((g) => `<url><loc>${base}/gigs/${g.id}</loc><lastmod>${g.created_at ?? now}</lastmod><priority>0.8</priority></url>`);
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...gigUrls].join("\n")}
</urlset>`;
	return new Response(xml, { headers: {
		"Content-Type": "application/xml",
		"Cache-Control": "public, max-age=3600"
	} });
}
//#endregion
//#region app/routes/robots[.]txt.tsx
var robots___txt_exports = /* @__PURE__ */ __exportAll({ loader: () => loader });
async function loader() {
	return new Response(`User-agent: *
Allow: /
Allow: /gigs/
Disallow: /auth
Disallow: /setup-profile
Disallow: /worker/
Disallow: /organizer/
Sitemap: https://gigdekho.com/sitemap.xml`, { headers: { "Content-Type": "text/plain" } });
}
//#endregion
//#region \0virtual:react-router/server-manifest
var server_manifest_default = {
	"entry": {
		"module": "/assets/entry.client-mQ4JOiJY.js",
		"imports": [
			"/assets/jsx-runtime-CHMssfQ2.js",
			"/assets/errorBoundaries-klv2zoLn.js",
			"/assets/preload-helper-B_l5jfgx.js"
		],
		"css": []
	},
	"routes": {
		"root": {
			"id": "root",
			"parentId": void 0,
			"path": "",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/root-BzYPTERf.js",
			"imports": [
				"/assets/jsx-runtime-CHMssfQ2.js",
				"/assets/errorBoundaries-klv2zoLn.js",
				"/assets/preload-helper-B_l5jfgx.js",
				"/assets/AuthContext-B26zgKeT.js",
				"/assets/lib-DPzMceZ9.js"
			],
			"css": ["/assets/root-CZxDM6ZV.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/home": {
			"id": "routes/home",
			"parentId": "root",
			"path": void 0,
			"index": true,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/home-BxbWBGfy.js",
			"imports": [
				"/assets/jsx-runtime-CHMssfQ2.js",
				"/assets/AuthContext-B26zgKeT.js",
				"/assets/preload-helper-B_l5jfgx.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/auth": {
			"id": "routes/auth",
			"parentId": "root",
			"path": "auth",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/auth-kZQWE33n.js",
			"imports": [
				"/assets/jsx-runtime-CHMssfQ2.js",
				"/assets/AuthLeftPanel-JmZVL9LX.js",
				"/assets/AuthContext-B26zgKeT.js",
				"/assets/createLucideIcon-CnD2rdQz.js",
				"/assets/mail-CYNsmSZl.js",
				"/assets/star-wwZD__Db.js",
				"/assets/preload-helper-B_l5jfgx.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/setup-profile": {
			"id": "routes/setup-profile",
			"parentId": "root",
			"path": "setup-profile",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/setup-profile-BBejoRax.js",
			"imports": [
				"/assets/jsx-runtime-CHMssfQ2.js",
				"/assets/AuthLeftPanel-JmZVL9LX.js",
				"/assets/AuthContext-B26zgKeT.js",
				"/assets/star-wwZD__Db.js",
				"/assets/createLucideIcon-CnD2rdQz.js",
				"/assets/preload-helper-B_l5jfgx.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/gigs.$id": {
			"id": "routes/gigs.$id",
			"parentId": "root",
			"path": "gigs/:id",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/gigs._id-DobIY-o8.js",
			"imports": [
				"/assets/jsx-runtime-CHMssfQ2.js",
				"/assets/AuthContext-B26zgKeT.js",
				"/assets/utils-CbC64Arx.js",
				"/assets/createLucideIcon-CnD2rdQz.js",
				"/assets/chevron-right-BExCUMCC.js",
				"/assets/circle-alert-CTCB9A_N.js",
				"/assets/users-C2vExHJm.js",
				"/assets/map-pin-BJ5hbmPt.js",
				"/assets/preload-helper-B_l5jfgx.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/public-layout": {
			"id": "routes/public-layout",
			"parentId": "root",
			"path": void 0,
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/public-layout-B7MWREiS.js",
			"imports": [
				"/assets/jsx-runtime-CHMssfQ2.js",
				"/assets/Footer-CV8vCAJ4.js",
				"/assets/AuthContext-B26zgKeT.js",
				"/assets/createLucideIcon-CnD2rdQz.js",
				"/assets/briefcase-CIakn84D.js",
				"/assets/log-out-KfwztWi3.js",
				"/assets/mail-CYNsmSZl.js",
				"/assets/map-pin-BJ5hbmPt.js",
				"/assets/wallet-Btched8L.js",
				"/assets/lib-DPzMceZ9.js",
				"/assets/preload-helper-B_l5jfgx.js",
				"/assets/errorBoundaries-klv2zoLn.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/worker.home": {
			"id": "routes/worker.home",
			"parentId": "routes/public-layout",
			"path": "worker/home",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/worker.home-BtVVv-gp.js",
			"imports": [
				"/assets/jsx-runtime-CHMssfQ2.js",
				"/assets/AuthContext-B26zgKeT.js",
				"/assets/utils-CbC64Arx.js",
				"/assets/createLucideIcon-CnD2rdQz.js",
				"/assets/briefcase-CIakn84D.js",
				"/assets/users-C2vExHJm.js",
				"/assets/map-pin-BJ5hbmPt.js",
				"/assets/star-wwZD__Db.js",
				"/assets/preload-helper-B_l5jfgx.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/app-layout": {
			"id": "routes/app-layout",
			"parentId": "root",
			"path": void 0,
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/app-layout-BWUPOoLh.js",
			"imports": [
				"/assets/jsx-runtime-CHMssfQ2.js",
				"/assets/Footer-CV8vCAJ4.js",
				"/assets/AuthContext-B26zgKeT.js",
				"/assets/createLucideIcon-CnD2rdQz.js",
				"/assets/briefcase-CIakn84D.js",
				"/assets/log-out-KfwztWi3.js",
				"/assets/mail-CYNsmSZl.js",
				"/assets/map-pin-BJ5hbmPt.js",
				"/assets/wallet-Btched8L.js",
				"/assets/lib-DPzMceZ9.js",
				"/assets/preload-helper-B_l5jfgx.js",
				"/assets/errorBoundaries-klv2zoLn.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/worker.dashboard": {
			"id": "routes/worker.dashboard",
			"parentId": "routes/app-layout",
			"path": "worker/dashboard",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/worker.dashboard-B0cIRDG0.js",
			"imports": [
				"/assets/jsx-runtime-CHMssfQ2.js",
				"/assets/AuthContext-B26zgKeT.js",
				"/assets/utils-CbC64Arx.js",
				"/assets/briefcase-CIakn84D.js",
				"/assets/chevron-right-BExCUMCC.js",
				"/assets/preload-helper-B_l5jfgx.js",
				"/assets/createLucideIcon-CnD2rdQz.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/worker.earnings": {
			"id": "routes/worker.earnings",
			"parentId": "routes/app-layout",
			"path": "worker/earnings",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/worker.earnings-BfGxTOGv.js",
			"imports": [
				"/assets/jsx-runtime-CHMssfQ2.js",
				"/assets/AuthContext-B26zgKeT.js",
				"/assets/utils-CbC64Arx.js",
				"/assets/createLucideIcon-CnD2rdQz.js",
				"/assets/circle-alert-CTCB9A_N.js",
				"/assets/wallet-Btched8L.js",
				"/assets/preload-helper-B_l5jfgx.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/worker.profile": {
			"id": "routes/worker.profile",
			"parentId": "routes/app-layout",
			"path": "worker/profile",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/worker.profile-CJ9cr89X.js",
			"imports": [
				"/assets/jsx-runtime-CHMssfQ2.js",
				"/assets/AuthContext-B26zgKeT.js",
				"/assets/createLucideIcon-CnD2rdQz.js",
				"/assets/log-out-KfwztWi3.js",
				"/assets/map-pin-BJ5hbmPt.js",
				"/assets/star-wwZD__Db.js",
				"/assets/preload-helper-B_l5jfgx.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/organizer.home": {
			"id": "routes/organizer.home",
			"parentId": "routes/app-layout",
			"path": "organizer/home",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/organizer.home-BnUzXI4g.js",
			"imports": ["/assets/jsx-runtime-CHMssfQ2.js"],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/sitemap[.]xml": {
			"id": "routes/sitemap[.]xml",
			"parentId": "root",
			"path": "sitemap.xml",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": false,
			"hasErrorBoundary": false,
			"module": "/assets/sitemap_._xml-B-06LnTL.js",
			"imports": [],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/robots[.]txt": {
			"id": "routes/robots[.]txt",
			"parentId": "root",
			"path": "robots.txt",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": false,
			"hasErrorBoundary": false,
			"module": "/assets/robots_._txt-BnbMunFM.js",
			"imports": [],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		}
	},
	"url": "/assets/manifest-737387b4.js",
	"version": "737387b4",
	"sri": void 0
};
//#endregion
//#region \0virtual:react-router/server-build
var assetsBuildDirectory = "build\\client";
var basename = "/";
var future = { "unstable_optimizeDeps": false };
var ssr = true;
var isSpaMode = false;
var prerender = [];
var routeDiscovery = {
	"mode": "lazy",
	"manifestPath": "/__manifest"
};
var publicPath = "/";
var entry = { module: entry_server_exports };
var routes = {
	"root": {
		id: "root",
		parentId: void 0,
		path: "",
		index: void 0,
		caseSensitive: void 0,
		module: root_exports
	},
	"routes/home": {
		id: "routes/home",
		parentId: "root",
		path: void 0,
		index: true,
		caseSensitive: void 0,
		module: home_exports
	},
	"routes/auth": {
		id: "routes/auth",
		parentId: "root",
		path: "auth",
		index: void 0,
		caseSensitive: void 0,
		module: auth_exports
	},
	"routes/setup-profile": {
		id: "routes/setup-profile",
		parentId: "root",
		path: "setup-profile",
		index: void 0,
		caseSensitive: void 0,
		module: setup_profile_exports
	},
	"routes/gigs.$id": {
		id: "routes/gigs.$id",
		parentId: "root",
		path: "gigs/:id",
		index: void 0,
		caseSensitive: void 0,
		module: gigs_$id_exports
	},
	"routes/public-layout": {
		id: "routes/public-layout",
		parentId: "root",
		path: void 0,
		index: void 0,
		caseSensitive: void 0,
		module: public_layout_exports
	},
	"routes/worker.home": {
		id: "routes/worker.home",
		parentId: "routes/public-layout",
		path: "worker/home",
		index: void 0,
		caseSensitive: void 0,
		module: worker_home_exports
	},
	"routes/app-layout": {
		id: "routes/app-layout",
		parentId: "root",
		path: void 0,
		index: void 0,
		caseSensitive: void 0,
		module: app_layout_exports
	},
	"routes/worker.dashboard": {
		id: "routes/worker.dashboard",
		parentId: "routes/app-layout",
		path: "worker/dashboard",
		index: void 0,
		caseSensitive: void 0,
		module: worker_dashboard_exports
	},
	"routes/worker.earnings": {
		id: "routes/worker.earnings",
		parentId: "routes/app-layout",
		path: "worker/earnings",
		index: void 0,
		caseSensitive: void 0,
		module: worker_earnings_exports
	},
	"routes/worker.profile": {
		id: "routes/worker.profile",
		parentId: "routes/app-layout",
		path: "worker/profile",
		index: void 0,
		caseSensitive: void 0,
		module: worker_profile_exports
	},
	"routes/organizer.home": {
		id: "routes/organizer.home",
		parentId: "routes/app-layout",
		path: "organizer/home",
		index: void 0,
		caseSensitive: void 0,
		module: organizer_home_exports
	},
	"routes/sitemap[.]xml": {
		id: "routes/sitemap[.]xml",
		parentId: "root",
		path: "sitemap.xml",
		index: void 0,
		caseSensitive: void 0,
		module: sitemap___xml_exports
	},
	"routes/robots[.]txt": {
		id: "routes/robots[.]txt",
		parentId: "root",
		path: "robots.txt",
		index: void 0,
		caseSensitive: void 0,
		module: robots___txt_exports
	}
};
var allowedActionOrigins = false;
//#endregion
export { allowedActionOrigins, server_manifest_default as assets, assetsBuildDirectory, basename, entry, future, isSpaMode, prerender, publicPath, routeDiscovery, routes, ssr };
