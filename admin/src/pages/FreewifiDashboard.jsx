import React from "react";
import { Link } from "react-router-dom";
export default function FreewifiDashboard() {
  return (
    <div className="dark:bg-gray-900">
      <section className="mx-auto container py-20 ">
        <div className="flex justify-center items-center flex-col">
          <div className="lg:text-6xl md:text-5xl text-4xl font-black leading-10 text-center text-gray-800 dark:text-white">
            <h1>Region 2 FreeWifi Inventory</h1>
          </div>
          <div className="pt-24 grid lg:grid-cols-3 md:grid-cols-2 justify-center items-center xl:gap-y-16 gap-y-20 gap-x-16 lg:gap-x-20 xl:gap-x-0 lg:px-10 xl:px-0">
          <Link to="">
            <div className="cursor-pointer hover:shadow py-6 xl:px-4 rounded xl:w-96 w-60 flex justify-center items-center flex-col">
              <div className="mb-6">
                <svg className width={32} height={32} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 13.3333H32L28 8L24 13.3333ZM24 18.6667H32L28 24L24 18.6667Z" fill="#C7D2FE" />
                  <path d="M1.33333 0H9.33333V32H1.33333C0.979711 32 0.640572 31.8595 0.390523 31.6095C0.140475 31.3594 0 31.0203 0 30.6667V1.33333C0 0.979711 0.140475 0.640572 0.390523 0.390523C0.640572 0.140475 0.979711 0 1.33333 0Z" fill="#818CF8" />
                  <path d="M12 0H20C20.3536 0 20.6928 0.140475 20.9428 0.390523C21.1929 0.640572 21.3333 0.979711 21.3333 1.33333V30.6667C21.3333 31.0203 21.1929 31.3594 20.9428 31.6095C20.6928 31.8595 20.3536 32 20 32H12V0Z" fill="#6366F1" />
                </svg>
              </div>
              <div className="text-gray-800 dark:text-white text-2xl font-semibold text-center">
                <h2>Puchase</h2>
              </div>
              <div className="text-gray-600 dark:text-gray-300 mt-2 text-lg text-center ">
                <p>Manage purchase.</p>
              </div>
            </div>
            </Link>

            <Link to="">
            <div className="cursor-pointer hover:shadow py-6 xl:px-4 rounded xl:w-96 w-60 flex justify-center items-center flex-col">
              <div className="mb-6">
                <svg width={32} height={32} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5.33325 1.33337H30.6666L26.6666 9.33337H1.33325L5.33325 1.33337Z" fill="#818CF8" />
                  <path d="M5.33325 12H30.6666L26.6666 20H1.33325L5.33325 12Z" fill="#6366F1" />
                  <path d="M5.33325 22.6667H30.6666L26.6666 30.6667H1.33325L5.33325 22.6667Z" fill="#C7D2FE" />
                </svg>
              </div>
              <div className="text-gray-800 dark:text-white text-2xl font-semibold text-center">
                <h2>Stocks</h2>
              </div>
              <div className="text-gray-600 dark:text-gray-300 mt-2 text-lg text-center">
                <p>Manage stocks</p>
              </div>
            </div>
            </Link>

            <Link to="">
            <div className="cursor-pointer hover:shadow py-6 xl:px-4 rounded xl:w-96 w-60 flex justify-center items-center flex-col">
              <div className="mb-6">
                <svg width={32} height={32} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M30.6667 8.00004V2.66671C30.6667 2.31309 30.5262 1.97395 30.2762 1.7239C30.0261 1.47385 29.687 1.33337 29.3334 1.33337H2.66671C2.31309 1.33337 1.97395 1.47385 1.7239 1.7239C1.47385 1.97395 1.33337 2.31309 1.33337 2.66671V8.00004H30.6667Z" fill="#6366F1" />
                  <path d="M1.33337 10.6667V29.3334C1.33337 29.687 1.47385 30.0262 1.7239 30.2762C1.97395 30.5263 2.31309 30.6667 2.66671 30.6667H9.33337V10.6667H1.33337Z" fill="#C7D2FE" />
                  <path d="M12 30.6667H29.3333C29.687 30.6667 30.0261 30.5263 30.2761 30.2762C30.5262 30.0262 30.6667 29.687 30.6667 29.3334V10.6667H12V30.6667Z" fill="#818CF8" />
                </svg>
              </div>
              <div className="text-gray-800 dark:text-white text-2xl font-semibold text-center">
                <h2>Reports</h2>
              </div>
              <div className="text-gray-600 dark:text-gray-300 mt-2 text-lg text-center">
                <p>View reports</p>
              </div>
            </div>
            </Link>

          </div>
        </div>
      </section>
    </div>
  );
}
