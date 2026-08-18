import React from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import { Link } from 'react-router';

export default function Footer() {
  return (
    <footer className="bg-[#0A0A0A] border-t border-white/5 pt-16 pb-28 lg:pb-12 text-white/60 font-sans">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 mb-16">
          
          {/* Brand Info */}
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-white tracking-tight">GigDekho<span className="text-[#F4511E]">.</span></h2>
            <p className="text-sm font-medium leading-relaxed max-w-sm">
              GigDekho is Indore's hyperlocal staffing platform. Whether you need a waiter, a promoter, a DJ, or just an extra pair of hands — find the right person in minutes.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-bold mb-6">Quick Links</h3>
            <ul className="space-y-4 text-sm font-medium">
              <li><Link prefetch="intent" to="/worker/home" className="hover:text-[#F4511E] transition-colors">Browse Gigs</Link></li>
              <li><Link prefetch="intent" to="/auth?mode=worker" className="hover:text-[#F4511E] transition-colors">Join as Worker</Link></li>
              <li><Link prefetch="intent" to="/auth?mode=organizer" className="hover:text-[#F4511E] transition-colors">Hire People</Link></li>
              <li><Link prefetch="intent" to="/about" className="hover:text-[#F4511E] transition-colors">About Us</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-bold mb-6">Support</h3>
            <ul className="space-y-4 text-sm font-medium">
              <li><Link prefetch="intent" to="/about#faq" className="hover:text-[#F4511E] transition-colors">FAQ</Link></li>
              <li><Link prefetch="intent" to="/about#trust" className="hover:text-[#F4511E] transition-colors">Trust & Safety</Link></li>
              <li><Link prefetch="intent" to="/about#terms" className="hover:text-[#F4511E] transition-colors">Terms of Service</Link></li>
              <li><Link prefetch="intent" to="/about#privacy" className="hover:text-[#F4511E] transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>

          {/* Contact Us */}
          <div>
            <h3 className="text-white font-bold mb-6">Contact Us</h3>
            <ul className="space-y-4 text-sm font-medium">
              <li className="flex items-start">
                <Phone size={18} className="mr-3 text-[#F4511E] shrink-0 mt-0.5" />
                <div>
                  <a href="tel:+918423313611" className="block hover:text-white transition-colors">+91 84233 13611</a>
                  <a href="tel:+919827010006" className="block hover:text-white transition-colors mt-1">+91 98270 10006</a>
                </div>
              </li>
              <li className="flex items-start">
                <Mail size={18} className="mr-3 text-[#F4511E] shrink-0 mt-0.5" />
                <div className="break-all">
                  <a href="mailto:foundersyc@gmail.com" className="block hover:text-white transition-colors">foundersyc@gmail.com</a>
                  <a href="mailto:yashupadhyaywork01@gmail.com" className="block hover:text-white transition-colors mt-1">yashupadhyaywork01@gmail.com</a>
                </div>
              </li>
              <li className="flex items-start">
                <MapPin size={18} className="mr-3 text-[#F4511E] shrink-0 mt-0.5" />
                <span>Indore, Madhya Pradesh<br/>India</span>
              </li>
            </ul>
          </div>

        </div>
        
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center text-xs font-medium">
          <p>&copy; {new Date().getFullYear()} GigDekho Technologies. All rights reserved.</p>
          <p className="mt-2 md:mt-0">Made with ❤️ in Indore</p>
        </div>
      </div>
    </footer>
  );
}
