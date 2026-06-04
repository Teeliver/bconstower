CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`description` text,
	`is_read` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hero_slides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`subtitle` text,
	`image_url` varchar(500) NOT NULL,
	`link_url` varchar(500),
	`button_text` varchar(100),
	`is_active` boolean DEFAULT true,
	`display_order` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `hero_slides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` int NOT NULL DEFAULT 1,
	`site_title` varchar(255),
	`site_description` text,
	`favicon` varchar(255),
	`og_image` varchar(255),
	`logo` varchar(255),
	`logo_footer` varchar(255),
	`hotline` varchar(20),
	`email` varchar(255),
	`address` text,
	`copyright` varchar(255),
	`facebook_url` varchar(255),
	`zalo_url` varchar(255),
	`youtube_url` varchar(255),
	`google_analytics` varchar(50),
	`custom_scripts` text,
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `posts` DROP FOREIGN KEY `posts_author_id_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `posts` ADD `summary` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `content` text NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `thumbnail` varchar(255);--> statement-breakpoint
ALTER TABLE `posts` ADD `category` varchar(100) DEFAULT 'news';--> statement-breakpoint
ALTER TABLE `posts` ADD `status` varchar(50) DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `posts` ADD `views` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `posts` ADD `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `projects` ADD `lat` decimal(10,7);--> statement-breakpoint
ALTER TABLE `projects` ADD `lng` decimal(10,7);--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `address` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar` text;--> statement-breakpoint
ALTER TABLE `posts` DROP COLUMN `price`;--> statement-breakpoint
ALTER TABLE `posts` DROP COLUMN `address`;--> statement-breakpoint
ALTER TABLE `posts` DROP COLUMN `is_published`;