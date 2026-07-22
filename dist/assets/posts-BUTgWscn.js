import{s as a,q as p,r as u,v as d}from"./index-BqbJBgFx.js";function _(t,e){var s,i,n,c;let o,r=null;if(t.type==="poll"&&t.poll_options&&(o=t.poll_options.map(l=>({id:l.id,post_id:t.id,option_text:l.option_text,votes_count:l.poll_votes?l.poll_votes.length:0})),e)){for(const l of t.poll_options)if((s=l.poll_votes)!=null&&s.some(f=>f.user_id===e)){r=l.id;break}}return{...t,user:t.user??void 0,likes_count:t.post_likes?t.post_likes.length:0,comments_count:((n=(i=t.post_comments)==null?void 0:i[0])==null?void 0:n.count)??0,has_liked:e?!!((c=t.post_likes)!=null&&c.some(l=>l.user_id===e)):!1,poll_options:o,user_vote_option_id:r}}async function w(){let t,e;const o=await a.from("posts").select(`
      *,
      user:user_id (
        username,
        full_name,
        avatar_url
      ),
      post_likes (user_id),
      post_comments (count),
      poll_options (
        id,
        option_text,
        poll_votes (user_id)
      )
    `).order("created_at",{ascending:!1});if(o.error&&o.error.message.includes("poll_options")){const i=await a.from("posts").select(`
        *,
        user:user_id (
          username,
          full_name,
          avatar_url
        ),
        post_likes (user_id),
        post_comments (count)
      `).order("created_at",{ascending:!1});t=i.data,e=i.error}else t=o.data,e=o.error;if(e)throw e;const{data:{user:r}}=await a.auth.getUser(),s=r==null?void 0:r.id;return(t??[]).map(i=>_(i,s))}async function h(t){let e,o;const r=await a.from("posts").select(`
      *,
      user:user_id (
        username,
        full_name,
        avatar_url
      ),
      post_likes (user_id),
      post_comments (count),
      poll_options (
        id,
        option_text,
        poll_votes (user_id)
      )
    `).eq("id",t).single();if(r.error&&r.error.message.includes("poll_options")){const n=await a.from("posts").select(`
        *,
        user:user_id (
          username,
          full_name,
          avatar_url
        ),
        post_likes (user_id),
        post_comments (count)
      `).eq("id",t).single();e=n.data,o=n.error}else e=r.data,o=r.error;if(o)throw o;const{data:{user:s}}=await a.auth.getUser(),i=s==null?void 0:s.id;return _(e,i)}async function g(t){const{data:{user:e}}=await a.auth.getUser();if(!e)throw new Error("Not authenticated");d(t.title),d(t.description),t.poll_options&&t.poll_options.forEach(s=>{d(s)});const{data:o,error:r}=await a.from("posts").insert({title:t.title,description:t.description,image_url:t.image_url,type:t.type||"text",user_id:e.id}).select().single();if(r)throw r;if(t.type==="poll"&&t.poll_options&&t.poll_options.length>0){const s=t.poll_options.map(n=>({post_id:o.id,option_text:n})),{error:i}=await a.from("poll_options").insert(s);i&&console.error("Failed to create poll options",i)}try{await u(e.id,10)}catch(s){console.error("Failed to award points for post creation",s)}return o}async function y(t,e){const{data:{user:o}}=await a.auth.getUser();if(!o)throw new Error("Not authenticated");const{data:r,error:s}=await a.from("poll_votes").select("id").eq("post_id",t).eq("user_id",o.id).maybeSingle();if(s)throw s;if(r)throw new Error("You have already voted on this poll");const{error:i}=await a.from("poll_votes").insert({post_id:t,poll_option_id:e,user_id:o.id});if(i)throw i;try{await u(o.id,1)}catch(n){console.error("Failed to award points for voting",n)}}async function v(t,e){const{data:{user:o}}=await a.auth.getUser();if(!o)throw new Error("Not authenticated");if(e){const{error:r}=await a.from("post_likes").delete().eq("post_id",t).eq("user_id",o.id);if(r)throw r;try{await p(o.id,1)}catch(s){console.error("Failed to deduct points for post unlike",s)}}else{const{error:r}=await a.from("post_likes").insert({post_id:t,user_id:o.id});if(r)throw r;try{await u(o.id,1)}catch(s){console.error("Failed to award points for post like",s)}}}async function E(t){const{data:e,error:o}=await a.from("post_comments").select(`
      *,
      user:user_id (
        username,
        full_name,
        avatar_url
      )
    `).eq("post_id",t).order("created_at",{ascending:!0});if(o)throw o;const r=new Map,s=[];return e.forEach(i=>{r.set(i.id,{...i,replies:[]})}),e.forEach(i=>{var n;if(i.parent_id){const c=r.get(i.parent_id);c&&((n=c.replies)==null||n.push(r.get(i.id)))}else s.push(r.get(i.id))}),s}async function k(t,e,o){const{data:{user:r}}=await a.auth.getUser();if(!r)throw new Error("Not authenticated");d(e);const{data:s,error:i}=await a.from("post_comments").insert({post_id:t,user_id:r.id,content:e,parent_id:o||null}).select(`
      *,
      user:user_id (
        username,
        full_name,
        avatar_url
      )
    `).single();if(i)throw i;try{await u(r.id,2)}catch(n){console.error("Failed to award points for comment creation",n)}return s}async function q(t){const{data:{user:e}}=await a.auth.getUser();if(!e)throw new Error("Not authenticated");const{error:o}=await a.from("posts").delete().eq("id",t);if(o)throw o;try{await p(e.id,10)}catch(r){console.error("Failed to deduct points for post deletion",r)}}async function P(t,e){e.title&&d(e.title),e.description&&d(e.description);const{data:o,error:r}=await a.from("posts").update({...e,updated_at:new Date().toISOString()}).eq("id",t).select().single();if(r)throw r;return o}async function x(t){const{data:{user:e}}=await a.auth.getUser();if(!e)throw new Error("Not authenticated");const{error:o}=await a.from("post_comments").delete().eq("id",t);if(o)throw o;try{await p(e.id,2)}catch(r){console.error("Failed to deduct points for comment deletion",r)}}async function F(t,e){d(e);const{data:o,error:r}=await a.from("post_comments").update({content:e,updated_at:new Date().toISOString()}).eq("id",t).select().single();if(r)throw r;return o}export{h as a,E as b,g as c,x as d,k as e,w as f,P as g,q as h,v as t,F as u,y as v};
