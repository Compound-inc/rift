import {
	feature,
	product,
	featureItem,
	pricedFeatureItem,
	priceItem,
} from "atmn";

// Features
export const premium = feature({
	id: "premium",
	name: "Premium Messages",
	type: "single_use",
});

export const standard = feature({
	id: "standard",
	name: "Standard Messages",
	type: "single_use",
});

export const seats = feature({
	id: "seats",
	name: "Seats",
	type: "continuous_use",
});

// Products
export const free = product({
	id: "free",
	name: "Free",
	is_default: true,
	items: [
		featureItem({
			feature_id: premium.id,
			included_usage: 5,
			interval: "month",
		}),

		featureItem({
			feature_id: seats.id,
			included_usage: 1,
		}),

		featureItem({
			feature_id: standard.id,
			included_usage: 20,
			interval: "month",
		}),
	],
});

export const plus = product({
	id: "plus",
	name: "plus",
	items: [
		pricedFeatureItem({
			feature_id: seats.id,
			price: 190,
			interval: "month",
			included_usage: 1,
			billing_units: 1,
			usage_model: "prepaid",
		}),

		featureItem({
			feature_id: premium.id,
			included_usage: 100,
			interval: "month",
		}),

		featureItem({
			feature_id: standard.id,
			included_usage: 1000,
			interval: "month",
		}),
	],
});

export const pro = product({
	id: "pro",
	name: "pro",
	items: [
		pricedFeatureItem({
			feature_id: seats.id,
			price: 480,
			interval: "month",
			included_usage: 1,
			billing_units: 1,
			usage_model: "prepaid",
		}),

		featureItem({
			feature_id: premium.id,
			included_usage: 270,
			interval: "month",
		}),

		featureItem({
			feature_id: standard.id,
			included_usage: 2700,
			interval: "month",
		}),
	],
});
