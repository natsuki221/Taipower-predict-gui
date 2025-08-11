import { startLocalScheduler } from "@/lib/local-scheduler";


export function register () {

    startLocalScheduler();
    console.log("Instrumentation registered");
}