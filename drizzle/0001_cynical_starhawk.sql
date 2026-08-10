CREATE TABLE `containers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`containerNumber` varchar(16) NOT NULL,
	`shipmentId` int NOT NULL,
	`isoType` varchar(8) NOT NULL,
	`sizeType` varchar(48) NOT NULL,
	`status` enum('in_transit','at_port','customs_hold','delivered','delayed') NOT NULL DEFAULT 'in_transit',
	`sealNumber` varchar(24),
	`grossWeightKg` int,
	`currentLatitude` decimal(9,6),
	`currentLongitude` decimal(9,6),
	`currentLocation` varchar(160),
	`eta` timestamp,
	`progressPercent` int NOT NULL DEFAULT 0,
	`lastEventAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `containers_id` PRIMARY KEY(`id`),
	CONSTRAINT `containers_containerNumber_unique` UNIQUE(`containerNumber`)
);
--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`containerId` int NOT NULL,
	`portId` int,
	`eventCode` varchar(16) NOT NULL,
	`eventLabel` varchar(128) NOT NULL,
	`description` varchar(255),
	`locationName` varchar(160),
	`vesselName` varchar(128),
	`status` enum('in_transit','at_port','customs_hold','delivered','delayed'),
	`isActual` int NOT NULL DEFAULT 1,
	`eventAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(8) NOT NULL,
	`name` varchar(128) NOT NULL,
	`city` varchar(128) NOT NULL,
	`country` varchar(96) NOT NULL,
	`countryCode` varchar(2) NOT NULL,
	`latitude` decimal(9,6) NOT NULL,
	`longitude` decimal(9,6) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ports_id` PRIMARY KEY(`id`),
	CONSTRAINT `ports_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingRef` varchar(32) NOT NULL,
	`billOfLading` varchar(32) NOT NULL,
	`carrier` varchar(96) NOT NULL,
	`carrierScac` varchar(8),
	`vesselName` varchar(128) NOT NULL,
	`vesselImo` varchar(16),
	`voyageNumber` varchar(24),
	`originPortId` int NOT NULL,
	`destinationPortId` int NOT NULL,
	`shipper` varchar(160),
	`consignee` varchar(160),
	`commodity` varchar(160),
	`etd` timestamp,
	`atd` timestamp,
	`eta` timestamp,
	`ata` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipments_id` PRIMARY KEY(`id`),
	CONSTRAINT `shipments_bookingRef_unique` UNIQUE(`bookingRef`)
);
--> statement-breakpoint
CREATE INDEX `containers_shipment_idx` ON `containers` (`shipmentId`);--> statement-breakpoint
CREATE INDEX `containers_status_idx` ON `containers` (`status`);--> statement-breakpoint
CREATE INDEX `milestones_container_idx` ON `milestones` (`containerId`);--> statement-breakpoint
CREATE INDEX `milestones_event_at_idx` ON `milestones` (`eventAt`);--> statement-breakpoint
CREATE INDEX `shipments_origin_idx` ON `shipments` (`originPortId`);--> statement-breakpoint
CREATE INDEX `shipments_destination_idx` ON `shipments` (`destinationPortId`);