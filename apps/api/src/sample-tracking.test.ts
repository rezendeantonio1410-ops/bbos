import assert from "node:assert/strict";
import test from "node:test";
import { nextStatus, readTrackInfo, track17 } from "./sample-tracking";

const entry = (status: string, events: Array<[string, string, string?]>, subStatus = "") => ({
  number: "879951396830",
  track_info: {
    latest_status: { status, sub_status: subStatus },
    tracking: {
      providers: [{ events: events.map(([time_iso, description, location]) => ({ time_iso, description, location })) }],
    },
  },
});

test("FedEx events become a dated history, oldest first, without duplicates", () => {
  const reading = readTrackInfo(entry("InTransit", [
    ["2026-11-14T09:00:00-03:00", "In transit", "MEMPHIS, TN"],
    ["2026-11-11T17:10:00-03:00", "Picked up", "LONDRINA, BR"],
    ["2026-11-14T09:00:00-03:00", "In transit", "MEMPHIS, TN"],
  ]));
  assert.equal(reading.step, "IN_TRANSIT");
  assert.equal(reading.events.length, 2);
  assert.equal(reading.events[0]!.description, "Picked up");
  assert.equal(reading.statusText, "Em trânsito");
});

test("customs clearance at destination is detected", () => {
  assert.equal(readTrackInfo(entry("InTransit", [["2026-11-18T10:00:00+08:00", "International shipment release - Import", "SHENZHEN CN"]])).step, "CUSTOMS");
  assert.equal(readTrackInfo(entry("InTransit", [["2026-11-18T10:00:00+08:00", "Arrived"]], "InTransit_CustomsProcessing")).step, "CUSTOMS");
});

test("delivered carries the delivery date; exceptions are flagged", () => {
  const delivered = readTrackInfo(entry("Delivered", [["2026-11-20T15:30:00+08:00", "Delivered", "SHENZHEN CN"]]));
  assert.equal(delivered.step, "DELIVERED");
  assert.equal(delivered.deliveredAt?.toISOString(), "2026-11-20T07:30:00.000Z");
  const problem = readTrackInfo(entry("Exception", [["2026-11-19T10:00:00+08:00", "Incorrect address"]]));
  assert.match(problem.problem ?? "", /Incorrect address/);
  assert.equal(readTrackInfo(entry("NotFound", [])).step, null);
  assert.equal(readTrackInfo({}).step, null);
});

test("the carrier only moves a sample forward", () => {
  assert.equal(nextStatus("PREPARED", "IN_TRANSIT"), "IN_TRANSIT");
  assert.equal(nextStatus("SENT", "DELIVERED"), "DELIVERED");
  assert.equal(nextStatus("IN_TRANSIT", "CUSTOMS"), "CUSTOMS");
  assert.equal(nextStatus("CUSTOMS", "IN_TRANSIT"), "IN_TRANSIT");
  assert.equal(nextStatus("DELIVERED", "IN_TRANSIT"), null);
  assert.equal(nextStatus("EVALUATED", "DELIVERED"), null);
  assert.equal(nextStatus("LOST", "DELIVERED"), null);
  assert.equal(nextStatus("SENT", "SENT"), null);
});

test("without the 17TRACK key nothing is called", async () => {
  const saved = process.env.TRACK17_API_KEY;
  delete process.env.TRACK17_API_KEY;
  let called = false;
  await assert.rejects(
    track17("gettrackinfo", [{ number: "1" }], (async () => { called = true; return new Response("{}"); }) as typeof fetch),
    /TRACK17_API_KEY/,
  );
  assert.equal(called, false);
  if (saved !== undefined) process.env.TRACK17_API_KEY = saved;
});

test("the key goes in the 17token header and carrier codes are sent", async () => {
  process.env.TRACK17_API_KEY = "test-key";
  let seen: { url: string; init: RequestInit } | null = null;
  const fake = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ code: 0, data: { accepted: [{ number: "879951396830" }], rejected: [] } }));
  }) as unknown as typeof fetch;
  const data = await track17("register", [{ number: "879951396830", carrier: 100003 }], fake);
  delete process.env.TRACK17_API_KEY;
  assert.equal(data.accepted?.length, 1);
  assert.equal(seen!.url, "https://api.17track.net/track/v2.2/register");
  assert.equal((seen!.init.headers as Record<string, string>)["17token"], "test-key");
  assert.deepEqual(JSON.parse(String(seen!.init.body)), [{ number: "879951396830", carrier: 100003 }]);
});

test("a carrier exception written only in the events is flagged (real FedEx and DHL of 26/11)", () => {
  const fedex = readTrackInfo(entry("InTransit", [
    ["2026-11-12T12:00:00Z", "Picked up", "LONDRINA, PR, BR"],
    ["2026-11-13T12:06:00Z", "On the way", "CAMPINAS, SP, BR"],
    ["2026-11-25T18:00:00Z", "Shipment exception, Improper or missing international paperwork, contact Customer Service", "CAMPINAS, SP, BR"],
    ["2026-11-25T18:14:00Z", "At local FedEx facility", "CAMPINAS, SP, BR"],
  ]));
  assert.match(fedex.problem ?? "", /^Ocorrência no envio: Shipment exception, Improper or missing international paperwork/);
  assert.equal(fedex.step, "IN_TRANSIT");
  const dhl = readTrackInfo(entry("InTransit", [
    ["2026-11-25T19:41:00Z", "Shipment Accepted", "CURITIBA - BRAZIL"],
    ["2026-11-25T20:18:00Z", "Shipment is on hold", "CURITIBA - BRAZIL"],
  ]));
  assert.match(dhl.problem ?? "", /Shipment is on hold/);
  const moving = readTrackInfo(entry("InTransit", [
    ["2026-11-20T10:00:00Z", "Shipment is on hold", "CURITIBA - BRAZIL"],
    ["2026-11-21T10:00:00Z", "Clearance event, released by customs", "CURITIBA - BRAZIL"],
    ["2026-11-26T10:00:00Z", "Departed facility", "LEIPZIG - GERMANY"],
  ]));
  assert.equal(moving.problem, null);
});
